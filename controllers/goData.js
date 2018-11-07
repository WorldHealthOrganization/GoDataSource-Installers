/**
 * Launches the Go.Data web app from the `build` folder using PM2.
 */

'use strict'

/**
 * Starts Go.Data API & Web app
 */
const async = require('async')
const Tail = require('tail').Tail
const chokidar = require('chokidar')

const logger = require('./../logger/app').logger
const processUtil = require('./../utils/process')
const goDataAPI = require('./goDataAPI')
const settings = require('./settings')

const AppPaths = require('./../utils/paths')
const productName = AppPaths.desktopApp.package.name

const pm2 = require(AppPaths.pm2Module)

const init = (events, callback) => {
    startGoData(events, callback)
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

        logger.info(`Starting ${productName} PM2 process...`)
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



        // There's an OS bug on windows that freezes the files from being read. chokidar will force-poll the logs file.
        let watcher
        if (process.platform ==='win32') {
            watcher = chokidar.watch(AppPaths.appLogFile, {
                usePolling: true,
                interval: 1000
            }).on('all', (event, path) => {
                console.log(event, path);
            })
        }

        //create a read stream from the log file to detect when the app starts
        const tail = new Tail(AppPaths.appLogFile)

        tail.on('line', (data) => {
            const log = data.toString()
            events({text: `Configuring ${productName} web app...`, details: log})
            if (log.indexOf('Web server listening at:') > -1) {

                if (watcher) {
                    watcher.unwatch(AppPaths.appLogFile)
                    watcher.close()
                }
                tail.unwatch()

                logger.info(`Successfully started ${productName} web app!`)
                events({text: `Successfully started ${productName} web app!`})

                const urlIndex = log.indexOf('http')
                if (urlIndex > -1) {
                    return callback(null, log.substring(urlIndex))
                }

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

    callback || (callback = () => {})

    // delete the PM2 process
    logger.info('Attempt to terminate previous Go.Data process...')
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
    setAppPort,
    setDbPort,
    killGoData,
}
