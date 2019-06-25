#!/bin/bash

ARCH=x64

#parse parameters
for i in "$@"
do
case $i in
    -file=*|--file=*)
    FILE="${i#*=}"
    ;;
    *)
        #unknown option
        echo "Unknown option. Allowed options: --file"
        exit 1
    ;;
esac
done

platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 stop go-data/build/server/server.js --interpreter=platforms/linux/${ARCH}/default/node/bin/node
platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/scripts/restoreBackup.js --interpreter=platforms/linux/${ARCH}/default/node/bin/node --file=${FILE}
RESULT=$?
platforms/linux/${ARCH}/default/node/bin/node app-management/bin/pm2 start go-data/build/server/server.js --interpreter=platforms/linux/${ARCH}/default/node/bin/node/

exit ${RESULT}
