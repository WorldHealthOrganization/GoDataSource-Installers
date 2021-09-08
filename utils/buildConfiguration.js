'use strict';

/**
 * Returns an object { platform: String }
 * whose values can be used by the Go.Data low level API to set the build type and platform
 */

const { ARCH, MONGO_PLATFORM } = require('./../package');

const mapTypeToBuildConfiguration = () => {
    let result = {};

    let dependency = process.env.NODE_ENV === 'development' ? process.env.MONGO_PLATFORM : MONGO_PLATFORM;
    switch (dependency) {
        case 'darwin':
            result.platform = `mac_osx-${process.env.NODE_ENV === 'development' ? process.env.ARCH : ARCH}`;
            break;
        case 'win':
            result.platform = `windows-${process.env.NODE_ENV === 'development' ? process.env.ARCH : ARCH}`;
            break;
        case 'deb':
            result.platform = `linux_debian-${process.env.NODE_ENV === 'development' ? process.env.ARCH : ARCH}`;
            break;
        case 'rhel':
            result.platform = `linux_rhel-${process.env.NODE_ENV === 'development' ? process.env.ARCH : ARCH}`;
            break;
        default:
            result.platform = `windows-${process.env.NODE_ENV === 'development' ? process.env.ARCH : ARCH}`;
            break;
    }
    result.arch = process.env.NODE_ENV === 'development' ? process.env.ARCH : ARCH;
    return result;
};

module.exports = {
    mapTypeToBuildConfiguration
};
