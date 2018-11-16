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
const kill = require('kill-port')

const logger = require('./../logger/app').logger
const processUtil = require('./../utils/process')
const goDataAPI = require('./goDataAPI')
const settings = require('./settings')

const AppPaths = require('./../utils/paths')
const productName = AppPaths.desktopApp.package.name

const pm2 = require(AppPaths.pm2Module)

const {MONGO_PLATFORM} = require('./../package')

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
 * Starts Go.Data using PM2
 * @param events - Invoked with ({ options }).
 *      options.text - Event text
 *      options.details - Event detail
 * @param callback - Invoked with (err)
 */
function startGoData(events, callback) {
    logger.info(`Configuring ${productName} web app...`)
    events({text: `Configuring ${productName} web app...`})
    pm2.connect(true, (err) => {

        if (err) {
            err = new Error(`Error connecting PM2 process: ${err.message}`)
            logger.error(err.message)
            return callback(err)
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
                    // log file sends events to splash screen
                    stopWatchingLogFile()

                    err = new Error(`Error configuring the ${productName} web app: ${err.message}`)
                    logger.error(err.message)
                    return callback(err)
                }
                logger.info(`Started ${productName}`)
                pm2.disconnect()
            })

        // There's an OS bug on windows that freezes the files from being read. chokidar will force-poll the logs file.
        let watcher
        if (process.platform === 'win32') {
            watcher = chokidar.watch(AppPaths.appLogFile, {
                usePolling: true,
                interval: 1000
            }).on('all', (event, path) => {
                console.log(event, path)
            })
        }

        //create a read stream from the log file to detect when the app starts
        const tail = new Tail(AppPaths.appLogFile)

        let called = false

        tail.on('line', (data) => {
            const log = data.toString()
            events({text: `Configuring ${productName} web app...`, details: log})
            if (log.indexOf('Web server listening at:') > -1) {

                stopWatchingLogFile()

                logger.info(`Successfully started ${productName} web app!`)
                events({text: `Successfully started ${productName} web app!`})

                const urlIndex = log.indexOf('http')
                if (urlIndex > -1) {
                    called = true
                    return callback(null, log.substring(urlIndex))
                }

                called = true
                callback()
            }
        })

        // Sometimes 'Web server listening at http://localhost:8000' is not caught in the log file.
        // As a final fallback, set a 30 second timer that calls the callback if it's not previously been called.
        setTimeout(() => {
            settings.getAppPort((err, port) => {
                if (err) {
                    return !called && callback(err)
                }
                if (!called) {
                    logger.log(`${productName} start event callback not called, fallback to call callback after 30 seconds`)
                    callback(null, `http://localhost:${port}`)
                } else {
                    logger.log(`${productName} started, no need for 30 seconds fallback`)
                }
            })
        }, 30000)

        tail.on('error', (err) => {
            logger.error('ERROR ' + err.message)
        })

        function stopWatchingLogFile() {
            logger.info(`Stopping watch over log file ${AppPaths.appLogFile}`)
            if (watcher) {
                watcher.unwatch(AppPaths.appLogFile)
                watcher.close()
            }
            tail.unwatch()
        }
    })
}

/**
 * Terminates the GoData process (if any)
 * @param callback Invoked with (err, result)
 */
function killGoData(callback) {

    callback || (callback = () => {
    })

    // delete the PM2 process
    logger.info('Attempt to terminate previous Go.Data process...')
    pm2.connect(true, (err) => {

        if (err) {
            err = new Error(`Error connecting PM2 process: ${err.message}`)
            logger.error(err.message)
            return callback(err)
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
                    err = new Error(`Error retrieving ${productName} API PORT: ${err.message}`)
                    logger.error(err.message)
                    return callback(err)
                    // throw err
                }
                if (process.env.MONGO_PLATFORM === 'linux' || MONGO_PLATFORM === 'linux') {
                    kill(port)
                        .then((result) => {
                            if (result.stderr && result.stderr.length > 0) {
                                logger.error(`Error killing process on port ${port}: ${result.stderr}`)
                                return callback(result.stderr)

                            }
                            logger.info(`Killed process on port ${port}`)
                            callback()
                        })
                        .catch((e) => {
                            logger.error(`Error killing process on port ${port}: ${e}`)
                            callback(e)
                        })
                } else {
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
                }
            })
        })
    })
}

module.exports = {
    init,
    setAppPort,
    setDbPort,
    startGoData,
    killGoData,
}
