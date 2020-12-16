'use strict'

const fs = require('fs')

const AppPaths = require('./../utils/paths')
const appVersion = AppPaths.webApp.installedVersion

/**
 * Reads the .appVersion file and returns the app getVersion from it. If the file does not exist, it returns null.
 * @param callback - invoked with (err, getVersion)
 */
const getVersion = (callback) => {
    fs.readFile(appVersion, (err, data) => {
        if (err) return callback(err)
        callback(null, data.toString())
    })
}

/**
 * Creates the .appVersion file with the version number from go-data/build/package.json
 * @param callback
 */
const setVersion = (callback) => {
    fs.writeFile(appVersion, AppPaths.webApp.currentVersion, callback)
}

module.exports = {
    getVersion, setVersion
}
