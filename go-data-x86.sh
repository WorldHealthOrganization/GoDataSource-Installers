#!/bin/bash

MONGO_PORT=27017
GODATA_PORT=8000
APP_TYPE=hub
ARCH=x86
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
    -type=*|--type=*)
    APP_TYPE="${i#*=}"
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
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set buildType ${APP_TYPE}
platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config set buildPlatform ${ARCH}

#perform cleanup
echo "Stopping PM2 process..."
app-management/bin/pm2 stop server

echo "Stopping process on port ${MONGO_PORT}..."
kill -9 $(lsof -t -i:${MONGO_PORT})

echo "Stopping process on port ${GODATA_PORT}..."
kill -9 $(lsof -t -i:${GODATA_PORT})

#create path for Mongo
mkdir -p ${DBPATH}/data
mkdir -p ${DBPATH}/logs

#start Mongo
echo "Starting Mongo process on port ${MONGO_PORT}..."
platforms/linux/${ARCH}/default/mongodb/bin/mongod --dbpath ${DBPATH}/data --port=${MONGO_PORT} --fork --logpath=${DBPATH}/logs/db.log

#check file with app version
VERSION_PATH=${DBPATH}/.appVersion
if [ ! -f ${VERSION_PATH} ]; then
    #perform database population
    echo "Populating database..."
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/installer/common/config get version > ${DBPATH}/.appVersion
    platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/install/install.js init-database
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
    fi
fi

#start Go.Data
app-management/bin/pm2 start go-data/build/server/server.js

exit 0