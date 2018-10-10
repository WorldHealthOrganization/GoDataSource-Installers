'use strict'

const {spawnSync} = require('child_process')

const AppPaths = require('./../utils/paths')

const logDirectory = AppPaths.appLogDirectory
const logPath = AppPaths.appLogFile

var logger = require('electron-log')
const mkdirp = require('mkdirp')

/**
 * Configures the app logger to write to AppData/logs/app/app.log.
 */
const init = (callback) => {
    mkdirp(logDirectory, (err) => {
        if (err) {
            callback(err)
            throw err
        }
        logger.transports.file.level = 'info';
        logger.transports.file.file = logPath
        logger.info('Successfully initialized logger!')
        callback()
    })
}

module.exports = {
    init,
    logger
}
