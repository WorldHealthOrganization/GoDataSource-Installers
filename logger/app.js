'use strict'

const AppPaths = require('./../utils/paths')

const logDirectory = AppPaths.appLogDirectory
const logPath = AppPaths.appLogFile

let logger = require('electron-log')
const mkdirp = require('mkdirp')

/**
 * Configures the app logger to write to AppData/logs/app/app.log.
 */
const init = (callback) => {
    mkdirp(logDirectory, (err) => {
        if (err) {
            return callback(err)
        }
        logger.transports.file.level = 'info'
        logger.transports.file.file = logPath
        logger.transports.file.maxSize = 25 * 1024 * 1024
        logger.info('Successfully initialized logger!')
        callback()
    })
}

module.exports = {
    init,
    logger
}
