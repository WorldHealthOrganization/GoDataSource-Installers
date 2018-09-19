/**
 * Creates the {userData}/.settings file and writes settings to it.
 */

'use strict'

const fs = require('fs')

const AppPaths = require('./../utils/paths')
const settingsFile = AppPaths.desktopApp.settingsFile

/**
 * Reads the .settings file and returns the JSON parsed content as object.
 * @param callback - invoked with (err, getVersion)
 */
const getSettings = (callback) => {
    fs.readFile(settingsFile, (err, data) => {
        if (err) return callback(err)
        let settings = JSON.parse(data.toString())
        callback(null, settings)
    })
}

/**
 * Creates the .settings file with JSON content
 * @param callback
 */
const setSettings = (settings, callback) => {
    try {
        JSON.parse(settings)
        fs.writeFile(settingsFile, settings, callback)
    } catch (e) {
        callback(e)
    }
}


/**
 * Reads the .settings file and returns `mongoPort` variable
 * @param callback - invoked with (err, port)
 */
let mongoPort = null
const getMongoPort = (callback) => {
    if (mongoPort) {
        return callback(null, mongoPort)
    }
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                mongoPort = 27017
                return callback(null, mongoPort)
            } else {
                return callback(err, null)
            }
        }
        mongoPort = settings.mongoPort
        callback(null, mongoPort)
    })
}

/**
 * Reads the .settings file, sets the port and writes back the .settings file
 * @param callback
 */
const setMongoPort = (port, callback) => {
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                settings = { }
            } else {
                return callback(err, null)
            }
        }
        /// Will not assign to mongoPort as well. This way, the changes will take place when restarting the app.
        settings.mongoPort = port
        setSettings(settings, callback)
    })
}

module.exports = {
    getMongoPort,
    setMongoPort
}
