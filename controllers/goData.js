/**
 * Launches the Go.Data web app from the `build` folder using PM2.
 */

'use strict'

/**
 * Starts Go.Data API & Web app
 */
const async = require('async')
const Tail = require('tail').Tail

const logger = require('./../logger/app').logger
const processUtil = require('./../utils/process')
const goDataAPI = require('./goDataAPI')
const settings = require('./settings')

const AppPaths = require('./../utils/paths')
const productName = AppPaths.desktopApp.package.name

const pm2 = require(AppPaths.pm2Module)

const init = (events, callback) => {
    async.series([
            setAppPort,
            setDbPort,
            (callback) => {
                startGoData(events, callback)
            }
        ],
        (err, result) => {
            if (err) {
                return callback(err)
            }
            callback(null, result[2])
        })
}

function setAppPort(callback) {
    settings.getAppPort((err, port) => {
        if (err) {
            return callback(err)
        }
        goDataAPI.setAppPort(port, callback)
    })
}

function setDbPort(callback) {
    settings.getMongoPort((err, port) => {
        if (err) {
            return callback(err)
        }
        goDataAPI.setDbPort(port, callback)
    })
}

/**
 * Starts the Mongo database from depending on system configuration
 */
function startGoData(events, callback) {
    logger.info(`Configuring ${productName} web app...`)
    events({text: `Configuring ${productName} web app...`})
    pm2.connect(true, (err) => {

        if (err) {
            logger.error(`Error connecting PM2 process: ${err.message}`)
            throw err
        }

        logger.info(`Starting ${productName} Web App...`)
        pm2.start({
                apps: [
                    {
                        name: productName,
                        script: AppPaths.nodeFile,
                        args: ".",
                        cwd: AppPaths.webApp.directory,
                        output: AppPaths.appLogFile,
                        error: AppPaths.appLogFile
                    }
                ]
            },
            (err) => {
                if (err) {
                    logger.error(`Error configuring the ${productName} web app: ${err.message}`)
                    throw err
                }
                logger.info(`Started ${productName}`)
                pm2.disconnect()
            })

        //create a read stream from the log file to detect when the app starts

        const tail = new Tail(AppPaths.appLogFile)

        tail.on('line', (data) => {
            const log = data.toString()
            events({detail: log})
            if (log.indexOf('Web server listening at:') > -1) {
                logger.info(`Successfully started ${productName} web app!`)
                events({text: `Successfully started ${productName} web app!`})
                const urlIndex = log.indexOf('http')
                if (urlIndex > -1) {
                    return callback(null, log.substring(urlIndex))
                }
                tail.unwatch()
                callback()
            }
        })

        tail.on('error', (err) => {
            logger.error('ERROR' + err.message)
        })
    })
}

/**
 * Terminates the GoData process (if any)
 * @param callback Invoked with (err, result)
 */
function killGoData(callback) {
    // delete the PM2 process
    pm2.connect(true, (err) => {
        if (err) {
            logger.error(`Error connecting PM2 process: ${err.message}`)
            throw err
        }
        logger.info(`Deleting PM2 ${productName} process...`)
        pm2.delete(productName, (err) => {
            if (err) {
                logger.error(`Error deleting PM2 ${productName} process: ${err.message}`)
            } else {
                logger.info(`Deleted PM2 ${productName} process!`)
            }
            pm2.disconnect()
            goDataAPI.getAppPort((err, port) => {
                if (err) {
                    logger.error(`Error retrieving ${productName} API PORT: ${err.message}`)
                    throw err
                }
                processUtil.findPortInUse(port, (err, processes) => {
                    if (processes && processes.length > 0) {
                        async.each(
                            processes.map(p => p.pid),
                            processUtil.killProcess,
                            callback
                        )
                    } else {
                        callback()
                    }
                })
            })
        })
    })
}

module.exports = {
    init,
    killGoData,
}
