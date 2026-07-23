#!/bin/bash

# ---------------------------------------------------
# MongoDB binaries shipped in platforms/linux/x64/default/mongodb:
#   bin   -> MongoDB 5.0.21  (OpenSSL 1.1)               for Ubuntu 18.04 / 20.04
#   bin8  -> MongoDB 8.2.11  (OpenSSL 3, glibc >= 2.35)   for Ubuntu 22.04 and newer
#   bin3  -> MongoDB 3.2.21  (legacy, no TLS)             upgrade source only, never a start target
#
# The binary actually usable on this machine is detected below from the
# libraries present on the system (not from app/package versions), and any
# existing data directory is migrated to it automatically if needed.
# ---------------------------------------------------

MONGO_PORT=27000
GODATA_PORT=8000
ARCH=x64
DBPATH=db
UPGRADE=false

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

# ---------------------------------------------------
# Required tools check (fail fast with an actionable message instead of
# silently mis-detecting things or hanging forever later in the script)
# ---------------------------------------------------
if ! command -v lsof >/dev/null 2>&1; then
    echo "ERROR: 'lsof' is required by this script but is not installed."
    echo "Install it with: sudo apt-get install lsof"
    exit 1
fi

if ! ldconfig -p 2>/dev/null | grep -q 'libcurl\.so\.4'; then
    echo "ERROR: libcurl.so.4 was not found on this system (needed by MongoDB)."
    echo "Install it with: sudo apt-get install curl"
    exit 1
fi

MONGO_DIR="platforms/linux/${ARCH}/default/mongodb"
BIN5="${MONGO_DIR}/bin"
BIN8="${MONGO_DIR}/bin8"
BIN3="${MONGO_DIR}/bin3"

bin_to_major() {
    case "$1" in
        "$BIN5") echo 5 ;;
        "$BIN8") echo 8 ;;
        "$BIN3") echo 3 ;;
    esac
}

major_to_bin() {
    case "$1" in
        5) echo "$BIN5" ;;
        8) echo "$BIN8" ;;
        3) echo "$BIN3" ;;
    esac
}

# ---------------------------------------------------
# Detect which shipped MongoDB binary this OS can actually run, based on the
# libraries that are actually present (not on `openssl version`, which can be
# missing entirely on minimal/cloud images and used to silently default to
# the wrong binary).
# ---------------------------------------------------
detect_target_bin() {
    local glibc_ver has_ssl3=false has_ssl11=false

    glibc_ver=$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}')
    ldconfig -p 2>/dev/null | grep -q 'libssl\.so\.3' && has_ssl3=true
    ldconfig -p 2>/dev/null | grep -q 'libssl\.so\.1\.1' && has_ssl11=true

    if $has_ssl3 && [[ -n "$glibc_ver" ]] && [[ "$(printf '%s\n%s\n' "2.35" "$glibc_ver" | sort -V | head -1)" == "2.35" ]]; then
        echo "$BIN8"
    elif $has_ssl11; then
        echo "$BIN5"
    else
        echo "UNSUPPORTED"
    fi
}

TARGET_BIN=$(detect_target_bin)
if [[ "$TARGET_BIN" == "UNSUPPORTED" ]]; then
    echo "ERROR: could not find a compatible MongoDB binary for this system."
    echo "Detected glibc: $(getconf GNU_LIBC_VERSION 2>/dev/null), OpenSSL libs found: $(ldconfig -p 2>/dev/null | grep -o 'libssl\.so\.[0-9.]*' | sort -u | tr '\n' ' ')"
    echo "Supported systems: Ubuntu 18.04/20.04 (OpenSSL 1.1) or Ubuntu 22.04+ (OpenSSL 3 with glibc >= 2.35)."
    exit 1
fi
TARGET_MAJOR=$(bin_to_major "$TARGET_BIN")
echo "This system will use MongoDB ${TARGET_MAJOR}.x (${TARGET_BIN})"

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

# ---------------------------------------------------
# Figure out which MongoDB major version the existing data (if any) was
# created with, and migrate it (dump/restore) to TARGET_BIN if it doesn't
# match -- this is what makes "upgrade the OS, keep the data" work, since an
# OS upgrade is exactly what changes which binary TARGET_BIN resolves to.
# ---------------------------------------------------
MAJOR_MARKER="${DBPATH}/.mongoMajor"
DATA_EXISTS=false
if [[ -d "${DBPATH}/data" ]] && [[ -n "$(ls -A ${DBPATH}/data 2>/dev/null)" ]]; then
    DATA_EXISTS=true
fi

if $DATA_EXISTS; then
    if [[ -f "$MAJOR_MARKER" ]]; then
        EXISTING_MAJOR=$(cat "$MAJOR_MARKER")
    else
        # No marker yet -- this data predates this script's tracking.
        # First check for the old, well-known MongoDB 3.2 (mmapv1) case via
        # the legacy app-version convention.
        EXISTING_MAJOR=""
        VERSION_PATH=${DBPATH}/.appVersion
        if [[ -f "$VERSION_PATH" ]]; then
            settings_version=$(cat "$VERSION_PATH")
            minor_part=$(echo "$settings_version" | cut -d. -f2)
            if [[ "$minor_part" =~ ^[0-9]+$ ]] && [ 40 -gt "$minor_part" ]; then
                EXISTING_MAJOR=3
            fi
        fi

        # Read the WiredTiger version string written directly into the data
        # directory -- works even when neither mongod binary can open the data
        # (e.g. wrong OpenSSL on this OS, or FCV too old for the newer binary).
        # WiredTiger major <= 10 => data was written by MongoDB 5.x (BIN5)
        # WiredTiger major >= 11 => data was written by MongoDB 6+/8.x (BIN8)
        if [[ -z "$EXISTING_MAJOR" ]] && [[ -f "${DBPATH}/data/WiredTiger" ]]; then
            wt_major=$(grep -o 'WiredTiger [0-9]*\.' "${DBPATH}/data/WiredTiger" | head -1 | grep -o '[0-9]*' | head -1)
            if [[ -n "$wt_major" ]]; then
                if [[ "$wt_major" -ge 11 ]]; then
                    EXISTING_MAJOR=8
                else
                    EXISTING_MAJOR=5
                fi
                echo "Detected MongoDB ${EXISTING_MAJOR}.x data from WiredTiger version ${wt_major}.x"
            fi
        fi

        # Last resort: probe by briefly starting each binary and seeing which
        # one actually comes up on the port.
        if [[ -z "$EXISTING_MAJOR" ]]; then
            for probe_bin in "$BIN5" "$BIN8"; do
                ${probe_bin}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log >/dev/null 2>&1 || true
                sleep 2
                if [[ -n "$(lsof -t -i:${MONGO_PORT} 2>/dev/null)" ]]; then
                    kill -9 $(lsof -t -i:${MONGO_PORT}) || true
                    sleep 1
                    EXISTING_MAJOR=$(bin_to_major "$probe_bin")
                    break
                fi
            done
        fi

        if [[ -z "$EXISTING_MAJOR" ]]; then
            echo "ERROR: could not determine which MongoDB version created the existing data in ${DBPATH}/data."
            exit 1
        fi
        echo "$EXISTING_MAJOR" > "$MAJOR_MARKER"
    fi

    if [[ "$EXISTING_MAJOR" != "$TARGET_MAJOR" ]]; then
        echo "Detected MongoDB ${EXISTING_MAJOR}.x data, but this system runs MongoDB ${TARGET_MAJOR}.x -> migration REQUIRED."

        if [[ "$UPGRADE" != "true" && "$UPGRADE" != "TRUE" ]]; then
            echo ""
            echo "**********************************************************************"
            echo "Database migration is required (MongoDB ${EXISTING_MAJOR}.x -> ${TARGET_MAJOR}.x), but --upgrade is not set."
            echo "If you want to perform the migration now, re-run the script with: --upgrade=true"
            echo "Example: ./go-data-x64.sh --dbpath=${DBPATH} --dbport=${MONGO_PORT} --port=${GODATA_PORT} --upgrade=true"
            echo "**********************************************************************"
            exit 1
        fi

        SRC_BIN=$(major_to_bin "$EXISTING_MAJOR")
        timestamp=$(date +%s)
        mongo_move_path="data_backup_$timestamp"
        mongo_dump_path="db_dump_$timestamp"
        blue=$(tput setaf 4)
        normal=$(tput sgr0)
        db_size=$(du -sh ${DBPATH}/data | cut -f1)
        printf "${blue}---------------------------------------\nPlease copy this information to a file since you will need it later to finish the migration process.\n\nMongo migration from ${EXISTING_MAJOR}.x to ${TARGET_MAJOR}.x is necessary, for this you need ~ 3 x ${db_size} empty space, please make sure you have the required empty space before continuing. \n\nA backup will be created at the following location '${DBPATH}/${mongo_move_path}'. \n\nIf this backup exists and in case the migration fails please replace '${DBPATH}/data' folder with '${DBPATH}/${mongo_move_path}' and remove '${mongo_dump_path}' if it wasn't removed by the system. \n\nOtherwise after confirming that everything works properly you can remove '${DBPATH}/${mongo_move_path}'.\n\nIf you get a missing lib error then please read the 'IMPORTANT' section from 'go-data-x64.sh' file.\n\n${normal}"
        read -p "Write 'y' to continue, or anything else to stop " -n 1 -r
        printf "\n"
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Migration process stopped..."
            exit 0
        fi

        echo "Starting MongoDB ${EXISTING_MAJOR}.x process on port ${MONGO_PORT} (from ${SRC_BIN})..."
        ${SRC_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

        echo "Dump MongoDB ${EXISTING_MAJOR}.x db to ${mongo_dump_path}..."
        ${SRC_BIN}/mongodump --port=${MONGO_PORT} --out=${mongo_dump_path}

        echo "Stopping MongoDB ${EXISTING_MAJOR}.x..."
        kill -9 $(lsof -t -i:${MONGO_PORT}) || true

        sleep 2

        echo "Renaming MongoDB ${EXISTING_MAJOR}.x db data to ${mongo_move_path}..."
        mv ${DBPATH}/data ${DBPATH}/${mongo_move_path}

        mkdir -p ${DBPATH}/data

        echo "Starting MongoDB ${TARGET_MAJOR}.x process on port ${MONGO_PORT} (from ${TARGET_BIN})..."
        ${TARGET_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

        echo "Restore db to MongoDB ${TARGET_MAJOR}.x from ${mongo_dump_path}..."
        ${TARGET_BIN}/mongorestore --port=${MONGO_PORT} ${mongo_dump_path}

        echo "Stopping MongoDB ${TARGET_MAJOR}.x..."
        kill -9 $(lsof -t -i:${MONGO_PORT}) || true

        sleep 2

        echo "Removing db dump from ${mongo_dump_path}..."
        rm -rf ${mongo_dump_path}

        echo "$TARGET_MAJOR" > "$MAJOR_MARKER"
        echo "Migration flow completed (dump/restore performed)."
    fi
fi

# start Mongo
echo "Starting Mongo process on port ${MONGO_PORT}..."
${TARGET_BIN}/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log
echo "$TARGET_MAJOR" > "$MAJOR_MARKER"

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
