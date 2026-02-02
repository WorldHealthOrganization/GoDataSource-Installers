#!/bin/bash

# ---------------------------------------------------
# IMPORTANT:
# If you get the following error:
#   platforms/linux/x64/default/mongodb/bin/mongod: error while loading shared libraries: libcurl.so.4: cannot open shared object file: No such file or directory
# You need to install "libcurl4"
#   depending of Linux distribution you might need to run something like:
#     sudo apt-get install curl libcurl4
# ---------------------------------------------------

MONGO_PORT=27000
GODATA_PORT=8000
ARCH=x64
DBPATH=db
UPGRADE=false

# --- ADDED FOR OPENSSL / UBUNTU VERSION DETECTION ---
# Detect OpenSSL version (major)
OPENSSL_VERSION=$(openssl version 2>/dev/null | awk '{print $2}' | cut -d. -f1)

# Default BIN_PATH = MongoDB 8 (bin) — may be overridden later depending on mode
BIN_PATH="platforms/linux/${ARCH}/default/mongodb/bin"

echo "Detected OpenSSL major version: $OPENSSL_VERSION"

#parse parameters
for i in "$@"
do
case $i in
    -dbport=*|--dbport=*)
    MONGO_PORT="${i#*=}"
    ;;
    -port=*|--port=*)
    GODATA_PORT="${i#*=}"
    ;;
    -dbpath=*|--dbpath=*)
    DBPATH="${i#*=}"
    ;;
    -upgrade=*|--upgrade=*)
    UPGRADE="${i#*=}"
    ;;
    *)
        #unknown option
        echo "Unknown option. Allowed options: --dbport, --dbpath, --port, --upgrade"
        exit 1
    ;;
esac
done

#set application configuration
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set dbPort ${MONGO_PORT}
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set apiPort ${GODATA_PORT}
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set buildPlatform ${ARCH}

#perform cleanup
echo "Stopping PM2 process..."
platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 stop server || true

#wait 1 second
sleep 1

echo "Stopping process on port ${GODATA_PORT}..."
kill -9 $(lsof -t -i:${GODATA_PORT}) || true

#wait 1 second
sleep 1

echo "Stopping process on port ${MONGO_PORT}..."
kill -9 $(lsof -t -i:${MONGO_PORT}) || true

#wait 1 second
sleep 1

#create path for Mongo
mkdir -p ${DBPATH}/data
mkdir -p ${DBPATH}/logs

set -e
# Any subsequent(*) commands which fail will cause the shell script to exit immediately

#must upgrade from mongo 3.2 to newer major ?
VERSION_PATH=${DBPATH}/.appVersion
if [[ -f "$VERSION_PATH" ]]; then
  # get app version
  settings_version=$(cat "$VERSION_PATH")
  settings_version_parts=$(echo $settings_version | tr "." "\n")
  settings_version_part_index=0;
  for settings_version_part in $settings_version_parts
  do
    version[$settings_version_part_index]=$settings_version_part
    settings_version_part_index=$(($settings_version_part_index+1))
  done

  # check if we need to upgrade db
  if [ 40 -gt ${version[1]} ]; then
    echo "Detected settings version ${settings_version} -> DB upgrade REQUIRED according to version rules."

    if [[ "$UPGRADE" != "true" && "$UPGRADE" != "TRUE" ]]; then
        # If upgrade is required but user didn't pass --upgrade=true, inform and exit
        echo ""
        echo "**********************************************************************"
        echo "Database upgrade is required (3.x -> newer major), but --upgrade is not set."
        echo "If you want to perform the upgrade now, re-run the script with: --upgrade=true"
        echo "Example: ./go-data-x64.sh --dbpath=${DBPATH} --dbport=${MONGO_PORT} --port=${GODATA_PORT} --upgrade=true"
        echo "**********************************************************************"
        exit 1
    fi

    # At this point UPGRADE == true, perform the upgrade flow
    timestamp=$(date +%s)
    mongo_move_path="data_backup_$timestamp"
    mongo_dump_path="db_dump_$timestamp"
    blue=$(tput setaf 4)
    normal=$(tput sgr0)
    db_size=$(du -sh ${DBPATH}/data | cut -f1)
    printf "${blue}---------------------------------------\nPlease copy this information to a file since you will need it later to finish the upgrade process.\n\nMongo upgrade from 3.2 to a newer major version is necessary, for this you need ~ 3 x ${db_size} empty space, please make sure you have the required empty space before continuing. \n\nA backup will be created at the following location '${DBPATH}/${mongo_move_path}'. \n\nIf this backup exists and in case the upgrade fails please replace '${DBPATH}/data' folder with '${DBPATH}/${mongo_move_path}' and remove '${mongo_dump_path}' if it wasn't removed by the system. \n\nOtherwise after confirming that everything works properly you can remove '${DBPATH}/${mongo_move_path}'.\n\nIf you get a missing lib error then please read the 'IMPORTANT' section from 'go-data-x64.sh' file.\n\n${normal}"
    read -p "Write 'y' to continue, or anything else to stop " -n 1 -r
    printf "\n"
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      # stopped upgrade process
      echo "Upgrade process stopped..."
      exit 0
    fi

    # choose binaries
    MONGO3_BIN="platforms/linux/${ARCH}/default/mongodb/bin3"

    # NOTE: per your specification:
    # - In UPGRADE mode: if OpenSSL is 1.x, upgrade target should be MongoDB 8 (default bin).
    #                  else (OpenSSL !=1) upgrade target should be MongoDB 5 (bin5).
    if [[ "$OPENSSL_VERSION" -eq 1 ]]; then
        TARGET_BIN="platforms/linux/${ARCH}/default/mongodb/bin5"
        echo "OpenSSL 1.x detected → Upgrading to MongoDB 5 (using ${TARGET_BIN})."
    else
        TARGET_BIN="platforms/linux/${ARCH}/default/mongodb/bin"
        echo "OpenSSL != 1.x detected → Upgrading to MongoDB 8 (using ${TARGET_BIN})."
    fi

    # it seems we need to migrate from 3.2 to target version
    echo "Must upgrade Mongo DB server from 3.x to target version..."

    # start Mongo 3.2
    echo "Starting Mongo 3.x process on port ${MONGO_PORT} (from ${MONGO3_BIN})..."
    ${MONGO3_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

    # dump database
    echo "Dump Mongo 3.x db to ${mongo_dump_path}..."
    ${MONGO3_BIN}/mongodump --port=${MONGO_PORT} --out=${mongo_dump_path}

    # stop mongo 3.2
    echo "Stopping Mongo 3.x..."
    kill -9 $(lsof -t -i:${MONGO_PORT}) || true

    # wait
    sleep 2

    # cleanup - move db folder to backup
    echo "Renaming Mongo 3.x db data to ${mongo_move_path}..."
    mv ${DBPATH}/data ${DBPATH}/${mongo_move_path}

    # create path for Mongo
    mkdir -p ${DBPATH}/data

    # start target mongo (5.x or 8.x)
    echo "Starting target Mongo process on port ${MONGO_PORT} (from ${TARGET_BIN})..."
    ${TARGET_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

    # restore database into target
    echo "Restore Mongo 3.x db to target Mongo from ${mongo_dump_path}..."
    ${TARGET_BIN}/mongorestore --port=${MONGO_PORT} ${mongo_dump_path}

    # stop target mongo
    echo "Stopping target Mongo..."
    kill -9 $(lsof -t -i:${MONGO_PORT}) || true

    # wait
    sleep 2

    # remove dump
    echo "Removing Mongo 3.x db dump from ${mongo_dump_path}..."
    rm -rf ${mongo_dump_path}

    echo "Upgrade flow completed (dump/restore performed)."
  fi
fi

# -----------------------------------------------
# Decide final mongo binary for NORMAL start
# Behavior:
#  - If not an upgrade run, pick final binary depending on OpenSSL:
#      OpenSSL 1.x -> bin5 (MongoDB 5)
#      else         -> bin  (MongoDB 8)
#  - If upgrade was executed above, still follow same final selection so we start the target binary
# -----------------------------------------------

if [[ "$OPENSSL_VERSION" -eq 1 ]]; then
    FINAL_BIN="platforms/linux/${ARCH}/default/mongodb/bin5"
    echo "OpenSSL 1.x detected -> final mongo binary will be: ${FINAL_BIN}"
else
    FINAL_BIN="platforms/linux/${ARCH}/default/mongodb/bin"
    echo "OpenSSL != 1.x detected -> final mongo binary will be: ${FINAL_BIN}"
fi

echo "Using FINAL MongoDB binary: $FINAL_BIN"

# start Mongo
echo "Starting Mongo process on port ${MONGO_PORT}..."
${FINAL_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

# check file with app version
VERSION_PATH=${DBPATH}/.appVersion
if [ ! -f ${VERSION_PATH} ]; then
    # perform database population
    echo "Populating database..."
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/install/install.js init-database
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version > ${DBPATH}/.appVersion
else
    # perform database migration if version is different
    settings_version=$(cat "$VERSION_PATH")
    echo "SETTINGS VERSION ${settings_version}"
    app_version=$(platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version)
    echo "APP VERSION ${app_version}"
    if [ "$settings_version" = "$app_version" ]; then
        echo "Database migration not needed."
    else
        echo "Migrating database from version ${settings_version} to ${app_version}..."
        platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/install/install.js migrate-database from ${settings_version} to ${app_version}
        platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version > ${DBPATH}/.appVersion
    fi
fi

# start Go.Data
platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 start go-data/build/server/server.js --interpreter=platforms/linux/${ARCH}/default/node/bin/node

# wait for both services to start
# api & mongo
echo ""
printf "Starting Go.Data server ( might take a while )"
while :
do
    if [[ `lsof -t -i:${GODATA_PORT}` ]]
    then
        break
    fi
    printf "."
    sleep 0.5
done
echo ""
echo "Go.Data server is running"

exit 0


# another version below not verified
#!/bin/bash

# ---------------------------------------------------
# IMPORTANT:
# If you get the following error:
#   platforms/linux/x64/default/mongodb/bin/mongod: error while loading shared libraries: libcurl.so.4
# install libcurl4:
#     sudo apt install libcurl4
# ---------------------------------------------------

MONGO_PORT=27000
GODATA_PORT=8000
ARCH=x64
DBPATH=db
UPGRADE=false

# ---------------------------------------------------
# Detect OpenSSL version (major.minor)
# ---------------------------------------------------
OPENSSL_FULL=$(openssl version 2>/dev/null | awk '{print $2}')
OPENSSL_MAJOR=$(echo "$OPENSSL_FULL" | cut -d. -f1)
OPENSSL_MINOR=$(echo "$OPENSSL_FULL" | cut -d. -f2)

echo "Detected OpenSSL version: $OPENSSL_FULL"

# ---------------------------------------------------
# Parse parameters
# ---------------------------------------------------
for i in "$@"
do
case $i in
    -dbport=*|--dbport=*)
        MONGO_PORT="${i#*=}"
    ;;
    -port=*|--port=*)
        GODATA_PORT="${i#*=}"
    ;;
    -dbpath=*|--dbpath=*)
        DBPATH="${i#*=}"
    ;;
    -upgrade=*|--upgrade=*)
        UPGRADE="${i#*=}"
    ;;
    *)
        echo "Unknown option. Allowed: --dbport, --dbpath, --port, --upgrade"
        exit 1
    ;;
esac
done

# ---------------------------------------------------
# Decide correct MongoDB Binary for this system
# ---------------------------------------------------
if [[ "$OPENSSL_MAJOR" -eq 1 && "$OPENSSL_MINOR" -eq 1 ]]; then
    # Ubuntu 18.04 / 20.04
    BIN_PATH="platforms/linux/${ARCH}/default/mongodb/bin5"
    echo "Using MongoDB 5.x (OpenSSL 1.1.x detected)"
elif [[ "$OPENSSL_MAJOR" -eq 3 ]]; then
    # Ubuntu 22.04 / 24.04
    BIN_PATH="platforms/linux/${ARCH}/default/mongodb/bin"
    echo "Using MongoDB 8.x (OpenSSL 3.x detected)"
else
    echo "Unsupported OpenSSL version: $OPENSSL_FULL"
    echo "Supported: 1.1.x → MongoDB 5, 3.x → MongoDB 8"
    exit 1
fi

# ---------------------------------------------------
# Set application configuration
# ---------------------------------------------------
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set dbPort ${MONGO_PORT}
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set apiPort ${GODATA_PORT}
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set buildPlatform ${ARCH}

# ---------------------------------------------------
# Stop existing processes
# ---------------------------------------------------
echo "Stopping PM2 process..."
platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 stop server || true

sleep 1
echo "Stopping process on port ${GODATA_PORT}..."
kill -9 $(lsof -t -i:${GODATA_PORT}) || true

sleep 1
echo "Stopping process on port ${MONGO_PORT}..."
kill -9 $(lsof -t -i:${MONGO_PORT}) || true

sleep 1

# Initialize DB dirs
mkdir -p ${DBPATH}/data
mkdir -p ${DBPATH}/logs

set -e

# ---------------------------------------------------
# Check if upgrade from MongoDB 3.2 is required
# ---------------------------------------------------
VERSION_PATH=${DBPATH}/.appVersion
if [[ -f "$VERSION_PATH" ]]; then

  settings_version=$(cat "$VERSION_PATH")
  settings_version_parts=$(echo $settings_version | tr "." "\n")
  idx=0
  for part in $settings_version_parts; do
    version[$idx]=$part
    idx=$((idx+1))
  done

  if [ 40 -gt ${version[1]} ]; then
      echo "Detected DB version ${settings_version} → Upgrade from MongoDB 3.2 required."

      if [[ "$UPGRADE" != "true" && "$UPGRADE" != "TRUE" ]]; then
          echo ""
          echo "**********************************************************************"
          echo "Database upgrade is required (MongoDB 3.2 → Newer), but --upgrade=true not provided."
          echo "Rerun with:"
          echo "   --upgrade=true"
          echo "**********************************************************************"
          exit 1
      fi

      # ---------------------------------------------------
      # UPGRADE FLOW: MongoDB 3.2 → MongoDB 5 OR MongoDB 8
      # ---------------------------------------------------
      timestamp=$(date +%s)
      mongo_move_path="data_backup_$timestamp"
      mongo_dump_path="db_dump_$timestamp"

      blue=$(tput setaf 4)
      normal=$(tput sgr0)
      db_size=$(du -sh ${DBPATH}/data | cut -f1)

      printf "${blue}---------------------------------------\n"
      printf "MongoDB upgrade needed. You need ~3x ${db_size} free space.\n"
      printf "Backup will be saved to: ${DBPATH}/${mongo_move_path}\n"
      printf "If upgrade fails, restore ${DBPATH}/data from that folder.\n"
      printf "${normal}"

      read -p "Write 'y' to continue or anything else to stop: " -n 1 -r
      echo ""
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Upgrade cancelled."
        exit 0
      fi

      MONGO3_BIN="platforms/linux/${ARCH}/default/mongodb/bin3"

      # Decide upgrade TARGET (5 or 8)
      if [[ "$OPENSSL_MAJOR" -eq 1 && "$OPENSSL_MINOR" -eq 1 ]]; then
          TARGET_BIN="platforms/linux/${ARCH}/default/mongodb/bin5"
          echo "Upgrading to MongoDB 5.x (OpenSSL 1.1.x)"
      else
          TARGET_BIN="platforms/linux/${ARCH}/default/mongodb/bin"
          echo "Upgrading to MongoDB 8.x (OpenSSL 3.x)"
      fi

      echo "Starting MongoDB 3.x..."
      ${MONGO3_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

      echo "Dumping DB..."
      ${MONGO3_BIN}/mongodump --port=${MONGO_PORT} --out=${mongo_dump_path}

      echo "Stopping MongoDB 3.x..."
      kill -9 $(lsof -t -i:${MONGO_PORT}) || true
      sleep 2

      echo "Backing up DB folder..."
      mv ${DBPATH}/data ${DBPATH}/${mongo_move_path}

      mkdir -p ${DBPATH}/data

      echo "Starting TARGET MongoDB (${TARGET_BIN})..."
      ${TARGET_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

      echo "Restoring DB into new MongoDB..."
      ${TARGET_BIN}/mongorestore --port=${MONGO_PORT} ${mongo_dump_path}

      echo "Stopping TARGET MongoDB..."
      kill -9 $(lsof -t -i:${MONGO_PORT}) || true
      sleep 2

      echo "Removing dump folder..."
      rm -rf ${mongo_dump_path}

      echo "Upgrade completed successfully."
  fi
fi

# ---------------------------------------------------
# FINAL MONGO BINARY SELECTOR (used after upgrade too)
# ---------------------------------------------------
if [[ "$OPENSSL_MAJOR" -eq 1 && "$OPENSSL_MINOR" -eq 1 ]]; then
    FINAL_BIN="platforms/linux/${ARCH}/default/mongodb/bin5"
else
    FINAL_BIN="platforms/linux/${ARCH}/default/mongodb/bin"
fi

echo "Starting final MongoDB using: ${FINAL_BIN}"

${FINAL_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log


# ---------------------------------------------------
# Database population or migration
# ---------------------------------------------------
VERSION_PATH=${DBPATH}/.appVersion
if [ ! -f ${VERSION_PATH} ]; then
    echo "Populating database..."
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/install/install.js init-database
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version > ${DBPATH}/.appVersion
else
    settings_version=$(cat "$VERSION_PATH")
    echo "SETTINGS VERSION ${settings_version}"
    app_version=$(platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version)
    echo "APP VERSION ${app_version}"
    if [ "$settings_version" != "$app_version" ]; then
        echo "Migrating DB ${settings_version} → ${app_version}..."
        platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/install/install.js migrate-database from ${settings_version} to ${app_version}
        platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version > ${DBPATH}/.appVersion
    else
        echo "Database migration not needed."
    fi
fi

# ---------------------------------------------------
# Start Go.Data
# ---------------------------------------------------
platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 start go-data/build/server/server.js --interpreter=platforms/linux/${ARCH}/default/node/bin/node

echo ""
printf "Starting Go.Data server (might take a while)"
while :
do
    if [[ `lsof -t -i:${GODATA_PORT}` ]]; then
        break
    fi
    printf "."
    sleep 0.5
done
echo ""
echo "Go.Data server is running"

exit 0

