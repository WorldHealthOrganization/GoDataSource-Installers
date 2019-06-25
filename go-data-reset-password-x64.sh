#!/bin/bash

ARCH=x64

platforms/linux/${ARCH}/default/node/bin/node go-data/build/server/install/install.js --interpreter=platforms/linux/${ARCH}/default/node/bin/node -- reset-admin-password

exit $?