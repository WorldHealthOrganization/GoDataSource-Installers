/**
 * Launches the Go.Data web app from the `build` folder using PM2.
 */

'use strict'

/**
 * Starts Go.Data API & Web app
 */

const {spawn} = require('child_process')

const async = require('async')
const Tail = require('tail').Tail

const logger = require('./../logger/app').logger
const processUtil = require('./../utils/process')

const AppPaths = require('./../utils/paths')

const pm2 = require(AppPaths.pm2Module)

const init = (events, callback) => {
    startGoData(events, callback)
}

/**
 * Starts the Mongo database from depending on system configuration
 */
function startGoData(events, callback) {
    logger.info(`Configuring Go.Data web app...`)
    events({text: `Configuring Go.Data web app...`})
    pm2.connect(true, (err) => {

        // check PM2 logs for app start
        // const startDbProcess = spawn(AppPaths.pm2File, ['logs', 'GoData', '--lines=0', `--interpreter=${AppPaths.nodeFile}`])
        // logger.info(AppPaths.pm2File)
        // logger.info(AppPaths.nodeFile)

        // startDbProcess.stdout.on('data', (data) => {
        //     const log = data.toString()
        //     logger.info(log)
        //     events({detail: log})
        //     if (log.indexOf('Web server listening at:') > -1) {
        //         logger.info(`Successfully started Go.Data web app!`)
        //         events({text: `Successfully started Go.Data web app!`})
        //         const urlIndex = log.indexOf('http')
        //         if (urlIndex > -1) {
        //             return callback(null, log.substring(urlIndex))
        //         }
        //         callback()
        //     }
        // })

        // startDbProcess.stderr.on('data', (data) => {
        //     logger.log(data.toString())
        // })

        if (err) {
            logger.error(`Error connecting PM2 process: ${err.message}`)
            throw err
        }

        logger.info('Starting Go.Data Web App...')
        pm2.start({
                apps: [
                    {
                        name: "GoData",
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
                    logger.error(`Error configuring the Go.Data web app: ${err.message}`)
                    throw err
                }
                logger.info(`Started GoData`)
                pm2.disconnect()
            })

        //create a read stream from the log file to detect when the app starts

        const tail = new Tail(AppPaths.appLogFile)

        tail.on('line', (data) => {
            const log = data.toString()
            events({detail: log})
            if (log.indexOf('Web server listening at:') > -1) {
                logger.info(`Successfully started Go.Data web app!`)
                events({text: `Successfully started Go.Data web app!`})
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
 * Calls go-data low level API to retrieve the port number
 * @param events Invoked with (err, event)
 * @param callback Invoked with (err, port)
 */
function getPort(callback) {
    logger.info('Retrieving GoData port from GoData API...')
    let port = null, error = null
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'get', 'apiPort'])
        .on('exit', (code) => {
            logger.info(`Go.Data Web 'get apiPort' exited with code ${code}`)
            callback(error, port)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        if (data) {
            let normalizedPort = data.toString().replace(/[\n\t\r]/g,"")
            logger.info(`Go.Data 'get apiPort' data: ${normalizedPort}`)
            port = normalizedPort
        }
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        if (data) {
            logger.error(`Go.Data 'get apiPort' error: ${data.toString()}`)
            error = data.toString()
        }
    })
}

/**
 * Calls go-data low level API to set the port number
 * @param port The port nubmer to be set
 * @param events Invoked with (err, event)
 * @param callback Invoked with (err, port)
 */
function setPort(port, callback) {
    logger.info(`Setting GoData port ${port} using GoData API...`)
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'set', 'apiPort', port])
        .on('exit', (code) => {
            console.log(`Go.Data Web 'set apiPort ${port}' exited with code ${code}`)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        console.log(`Go.Data 'set apiPort ${port}' data: ${data.toString()}`)
        callback(null, data.toString())
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        console.log(`Go.Data 'set apiPort ${port}' error: ${data.toString()}`)
        callback(data.toString())
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
        logger.info(`Deleting PM2 GoData process...`)
        pm2.delete('GoData', (err) => {
            if (err) {
                logger.error(`Error deleting PM2 GoData process: ${err.message}`)
            } else {
                logger.info(`Deleted PM2 GoData process!`)
            }
            pm2.disconnect()
            getPort((err, port) => {
                if (err) {
                    logger.error(`Error retrieving GoData API PORT: ${err.message}`)
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
    api: {
        getPort,
        setPort
    },
}
