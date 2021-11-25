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
    *)
        #unknown option
        echo "Unknown option. Allowed options: --dbport, --dbpath, --port, --type"
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
platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 stop server

#wait 1 second
sleep 1

echo "Stopping process on port ${GODATA_PORT}..."
kill -9 $(lsof -t -i:${GODATA_PORT})

#wait 1 second
sleep 1

echo "Stopping process on port ${MONGO_PORT}..."
kill -9 $(lsof -t -i:${MONGO_PORT})

#wait 1 second
sleep 1

#create path for Mongo
mkdir -p ${DBPATH}/data
mkdir -p ${DBPATH}/logs

set -e
# Any subsequent(*) commands which fail will cause the shell script to exit immediately

#must upgrade from mongo 3.2 to mongo 5.x ?
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
    # ask for confirmation before
    timestamp=$(date +%s)
    mongo_move_path="data_backup_$timestamp"
    blue=$(tput setaf 4)
    normal=$(tput sgr0)
    db_size=$(du -sh ${DBPATH}/data | cut -f1)
    printf "${blue}Mongo upgrade from 3.2 to 5.x is necessary, for this you need ~ 3 x ${db_size} empty space, please make sure you have the required empty space before continuing. \nA backup will be created at the following location '${DBPATH}/${mongo_move_path}'. If this backup exists and in case the upgrade fails please replace '${DBPATH}/data' folder with '${DBPATH}/${mongo_move_path}'. Otherwise after confirming that everything works properly you can remove '${DBPATH}/${mongo_move_path}'.\nIf you get a missing lib error then please read the 'IMPORTANT' section from 'go-data-x64.sh' file.\n${normal}"
    read -p "Write 'y' to continue, or anything else to stop " -n 1 -r
    printf "\n"
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      # stopped upgrade process
      echo "Upgrade process stopped..."

      # close process
      exit 0
    fi

    # it seems we need to migrate from 3.2 to 5.x
    echo "Must upgrade Mongo DB server from 3.x to 5.x..."

    # start Mongo 3.2
    echo "Starting Mongo 3.x process on port ${MONGO_PORT}..."
    platforms/linux/${ARCH}/default/mongodb/bin3/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

    # dump database
    mongo_dump_path="db_dump_$timestamp"
    echo "Dump Mongo 3.x db to ${mongo_dump_path}..."
    platforms/linux/${ARCH}/default/mongodb/bin3/mongodump --port=${MONGO_PORT} --out=${mongo_dump_path}

    # stop mongo 3.2
    echo "Stopping Mongo 3.x..."
    kill -9 $(lsof -t -i:${MONGO_PORT})

    # wait
    sleep 2

    # cleanup - remove db folder
    echo "Renaming Mongo 3.x db data..."
    mv ${DBPATH}/data ${DBPATH}/${mongo_move_path}

    # create path for Mongo
    mkdir -p ${DBPATH}/data

    # start mongo 5.x
    echo "Starting Mongo 5.x process on port ${MONGO_PORT}..."
    platforms/linux/${ARCH}/default/mongodb/bin/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

    # restore database
    echo "Restore Mongo 3.x db to Mongo 5.x from ${mongo_dump_path}..."
    platforms/linux/${ARCH}/default/mongodb/bin/mongorestore --port=${MONGO_PORT} ${mongo_dump_path}

    # stop mongo 5.x
    echo "Stopping Mongo 5.x..."
    kill -9 $(lsof -t -i:${MONGO_PORT})

    # wait
    sleep 2

    # remove dump
    echo "Removing Mongo 3.x db dump from ${mongo_dump_path}..."
    rm -rf ${mongo_dump_path}
  fi
fi

#start Mongo
echo "Starting Mongo process on port ${MONGO_PORT}..."
platforms/linux/${ARCH}/default/mongodb/bin/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

#check file with app version
VERSION_PATH=${DBPATH}/.appVersion
if [ ! -f ${VERSION_PATH} ]; then
    #perform database population
    echo "Populating database..."
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/install/install.js init-database
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version > ${DBPATH}/.appVersion
else
    #perform database migration if version is different
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

#start Go.Data
platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 start go-data/build/server/server.js --interpreter=platforms/linux/${ARCH}/default/node/bin/node

#wait for both services to start
#api & mongo
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
