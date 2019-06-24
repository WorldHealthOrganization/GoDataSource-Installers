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
const { nssmStatuses, goDataAPIServiceName, runNssmShell } = require('./nssm')

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
 * Decides whether to start Go.Data as service or as process and proceeds with chosen method
 * @param events - Invoked with ({ options }).
 *      options.text - Event text
 *      options.details - Event detail
 * @param callback - Invoked with (err)
 */
function startGoData(events, callback) {
    logger.info(`Configuring ${productName} web app...`)
    events({text: `Configuring ${productName} web app...`})

    if (settings.runGoDataAPIAsAService) {
        startGoDataAsService(events, callback)
    } else {
        startGoDataAsProcess(events, callback)
    }
}

/**
 * Launches Go.Data as a process using PM2 node API
 * @param events
 * @param callback
 */
function startGoDataAsProcess(events, callback) {
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
                    stopWatchingLogFile(options)

                    err = new Error(`Error configuring the ${productName} web app: ${err.message}`)
                    logger.error(err.message)
                    return callback(err)
                }
                logger.info(`Started ${productName}`)
                pm2.disconnect()
            })
        // will contain watcher and tail
        let options = { }
        detectAppStartFromLog(options, events, callback)
    })
}

/**
 * Launches Go.Data as a service. Nssm can not be used to create services from non-executable files, so we use the 'node-windows' module to create a service.
 * @param events
 * @param callback
 */
function startGoDataAsService(events, callback) {
    checkGoDataAPIService((err, status) => {
        switch (status) {
            // service not installed, install service
            case nssmStatuses.ServiceNotInstalled:
                // install service
                installGoDataAPIService((error, status) => {
                    // set service paramteres for logging
                    setGoDataAPIServiceParameters((error, statuses) => {
                        // recursive call this function to check again the status
                        startGoDataAsService(events, callback)
                    })
                })
                break
            // service in one status that requires just to be started
            case nssmStatuses.ServiceAlreadyInstalled:
            case nssmStatuses.ServiceStopped:
            case nssmStatuses.ServicePaused:
            case nssmStatuses.ServiceInstalled({goDataAPIServiceName}):
                let options = {}
                detectAppStartFromLog(options, events, callback)
                launchGoDataAPIService((error, status) => {
                    // The callback will not be called here. Once the service is launched, Go.Data takes some time to load
                    // To determine when Go.Data has loaded, we will check the web app log and then the callback will be called
                })
                break
            case nssmStatuses.ServiceRunning:
                callback()
                break
            default:
                callback(new Error(`Error starting GoData API Service! Service returned status ${status}`))
        }
    })
}

/**
 * Checks the app
 * @param options - contains watcher and tail
 * @param events
 * @param callback
 */
function detectAppStartFromLog(options, events, callback) {
    // There's an OS bug on windows that freezes the files from being read. chokidar will force-poll the logs file.
    if (process.platform === 'win32') {
        options.watcher = chokidar.watch(AppPaths.appLogFile, {
            usePolling: true,
            interval: 1000
        }).on('all', (event, path) => {
            console.log(event, path)
        })
    }

    //create a read stream from the log file to detect when the app starts
    options.tail = new Tail(AppPaths.appLogFile)

    // used to call the open Go.Data callback only once
    let called = false

    options.tail.on('line', (data) => {
        const log = data.toString()
        events({text: `Configuring ${productName} web app...`, details: log})
        if (log.indexOf('Web server listening at:') > -1) {

            stopWatchingLogFile(options)

            logger.info(`Successfully started ${productName} web app!`)
            events({text: `Successfully started ${productName} web app!`})

            const urlIndex = log.indexOf('http')
            if (urlIndex > -1 && !called) {
                called = true
                return callback(null, log.substring(urlIndex))
            }

            if (!called) {
                called = true
                callback()
            }
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
                logger.info(`${productName} start event callback not called, fallback to call callback after 60 seconds`)
                called = true
                callback(null, `http://localhost:${port}`)
            } else {
                logger.info(`${productName} started, no need for 60 seconds fallback`)
            }
        })
    }, 60000)

    options.tail.on('error', (err) => {
        logger.error('ERROR ' + err.message)
    })
}

/**
 * Stops watching a log file
 * @param options - contains watcher and tail
 */
function stopWatchingLogFile(options) {
    logger.info(`Stopping watch over log file ${AppPaths.appLogFile}`)
    if (options.watcher) {
        options.watcher.unwatch(AppPaths.appLogFile)
        options.watcher.close()
    }
    options.tail.unwatch()
}

/**
 * Checks the Mongo service using nssm.exe.
 * @param callback
 */
function checkGoDataAPIService(callback) {
    let command = ['status', goDataAPIServiceName]
    runNssmShell(command, { requiresElevation: false }, callback)
}

/**
 * Installs Mongo as a service using nssm.exe
 * @param callback
 */
function installGoDataAPIService(callback) {
    let command = ['install', goDataAPIServiceName, AppPaths.nodeFile, AppPaths.webApp.launchScript]
    runNssmShell(command, { requiresElevation: true, serviceName: goDataAPIServiceName }, callback)
}

/**
 * Sets the service parameters 'AppStdout' and 'AppStderr' to write to the same log file where it writes when Go.Data is launched as a process.
 * @param callback
 */
function setGoDataAPIServiceParameters(callback) {
    let appStdout = 'AppStdout'
    let appStderr = 'AppStderr'
    let outputCommand = ['set', goDataAPIServiceName, appStdout, AppPaths.appLogFile]
    let errorCommand = ['set', goDataAPIServiceName, appStderr, AppPaths.appLogFile]
    async.parallel([
        (callback) => {
            runNssmShell(outputCommand, { requiresElevation: true, serviceName: goDataAPIServiceName, serviceParameter: appStdout }, callback)
        },
        (callback) => {
            runNssmShell(errorCommand, { requiresElevation: true, serviceName: goDataAPIServiceName, serviceParameter: appStderr }, callback)
        }
    ], callback)
}

/**
 * Starts Mongo as a service using nssm.exe
 * @param callback
 */
function launchGoDataAPIService(callback) {
    let command = ['start', goDataAPIServiceName]
    runNssmShell(command, { requiresElevation: true }, callback)
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
