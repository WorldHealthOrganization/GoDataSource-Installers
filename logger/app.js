'use strict'

const {spawnSync} = require('child_process')

const AppPaths = require('./../utils/paths')

const logDirectory = AppPaths.appLogDirectory
const logPath = AppPaths.appLogFile

var logger = require('electron-log')

/**
 * Configures the app logger to write to AppData/logs/app/app.log.
 */
const init = () => {
    const logPathResult = spawnSync('mkdir', ['-p', `${logDirectory}`]).stderr.toString()
    if (logPathResult.length) {
        throw new Error(logPathResult)
    }
    logger.transports.file.level = 'info';
    logger.transports.file.file = logPath
    logger.info('Successfully initialized logger!')
}

module.exports = {
    init,
    logger
}
