'use strict'

const {app} = require('electron')
const path = require('path')
const {spawnSync} = require('child_process')
const logDirectory = path.join(app.getPath('userData'), 'logs/app')
const logPath = path.join(logDirectory, 'app.log')

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
    init, logger, logDirectory
}
