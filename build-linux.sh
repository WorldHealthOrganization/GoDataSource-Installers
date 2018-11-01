#!/bin/bash

ARCH=x64

for i in "$@"
do
case $i in
    -a=*|--architecture=*)
    ARCH="${i#*=}"
    ;;
    *)
        #unknown option
    ;;
esac
done

echo "Building linux installer for ${ARCH} architecture"
sleep 1

tar zvcf go-data-linux-${ARCH}.tar.gz app-management go-data/build platforms/linux/${ARCH}/default go-data-${ARCH}.sh

echo "Build complete!"

exit 0