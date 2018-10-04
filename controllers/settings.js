/**
 * Creates the {userData}/.settings file and writes settings to it.
 */

'use strict'

const fs = require('fs')

const AppPaths = require('./../utils/paths')
const settingsFile = AppPaths.desktopApp.settingsFile

const logger = require('./../logger/app').logger

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
        let setting = JSON.stringify(settings)
        fs.writeFile(settingsFile, setting, (err) => {
            if (err) {
                logger.info(`Error writing settings file: ${err.message}`)
                return callback(err)
            }
            logger.info(`Successfully wrote settings file.`)
            callback()
        })
    } catch (e) {
        callback(e)
    }
}

/**
 * Reads the .settings file and returns `apiPort` variable
 * @param callback - invoked with (err, port)
 */
let appPort = null
const getAppPort = (callback) => {
    if (appPort) {
        return callback(null, appPort)
    }
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                appPort = 8000
                return callback(null, appPort)
            } else {
                callback(null, null)
                throw new Error(`Error setting application port: ${err.message}`)
            }
        }
        appPort = settings.appPort
        callback(null, appPort)
    })
}

/**
 * Reads the .settings file, sets the port and writes back the .settings file
 * @param port
 * @param callback - Invoked with (err)
 */
const setAppPort = (port, callback) => {
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                settings = {}
            } else {
                return callback(err, null)
            }
        }
        appPort = port
        settings.appPort = port
        logger.info(`Writing App Port to settings file...`)
        setSettings(settings, callback)
    })
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
                callback(null, null)
                throw new Error(`Error setting Mongo port: ${err.message}`)
            }
        }
        mongoPort = settings.mongoPort
        callback(null, mongoPort)
    })
}

/**
 * Reads the .settings file, sets the port and writes back the .settings file
 * @param port
 * @param callback - Invoked with (err)
 */
const setMongoPort = (port, callback) => {
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                settings = {}
            } else {
                return callback(err, null)
            }
        }
        mongoPort = port
        settings.mongoPort = port
        logger.info(`Writing Mongo Port to settings file...`)
        setSettings(settings, callback)
    })
}

module.exports = {
    getMongoPort,
    setMongoPort,
    getAppPort,
    setAppPort
}