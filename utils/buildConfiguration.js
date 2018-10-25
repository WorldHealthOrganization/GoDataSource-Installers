'use strict'

/**
 * Receives 'hub' or 'consolidation' as parameter and returns an object { type: String, platform: String }
 * whose values can be used by the Go.Data low level API to set the build type and platform
 * @param type - String: 'hub' or 'consolidation'
 */
const mapTypeToBuildConfiguration = (type) => {
    let result = {}

    switch (type) {
        case 'consolidation':
            result.type = 'consolidation-server'
            break
        default:
            result.type = 'hub'
            break
    }
    switch (process.env.MONGO_PLATFORM) {
        case 'darwin':
            result.platform = `mac_osx-${process.env.ARCH}`
            break
        case 'win':
            result.platform = `windows-${process.env.ARCH}`
            break
        case 'deb':
            result.platform = `linux_debian-${process.env.ARCH}`
            break
        case 'rhel':
            result.platform = `linux_rhel-${process.env.ARCH}`
            break
        default:
            result.platform = `windows-${process.env.ARCH}`
            break
    }
    return result
}

module.exports = {
    mapTypeToBuildConfiguration
}
