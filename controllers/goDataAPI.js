'use strict'

const {spawn} = require('child_process')

const logger = require('./../logger/app').logger

const AppPaths = require('./../utils/paths')
const productName = AppPaths.desktopApp.package.name

/**
 * Calls go-data low level API to retrieve the port number
 * @param callback Invoked with (err, port)
 */
function getAppPort(callback) {
    let log = true // used to stop logging after script exits
    logger.info(`Retrieving ${productName} port from ${productName} API...`)
    let port = null, error = null
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'get', 'apiPort'])
        .on('exit', (code) => {
            log = false
            logger.info(`${productName} Web 'get apiPort' exited with code ${code}`)
            callback(error, port)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        if (data) {
            let normalizedPort = data.toString().replace(/[\n\t\r]/g, "")
            log && logger.info(`${productName} 'get apiPort' data: ${normalizedPort}`)
            port = normalizedPort
        }
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        if (data) {
            log && logger.error(`${productName} 'get apiPort' error: ${data.toString()}`)
            error = data.toString()
        }
    })
}

/**
 * Calls go-data low level API to set the port number
 * @param port - The port number to be set
 * @param callback - Invoked with (err, port)
 */
function setAppPort(port, callback) {
    let log = true // used to stop logging after script exits
    logger.info(`Setting ${productName} port ${port} using ${productName} API...`)
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'set', 'apiPort', port])
        .on('exit', (code) => {
            log = false
            logger.info(`${productName} Web 'set apiPort ${port}' exited with code ${code}`)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        log && logger.info(`${productName} 'set apiPort ${port}' data: ${data.toString()}`)
        callback(null, data.toString())
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        log && logger.error(`${productName} 'set apiPort ${port}' error: ${data.toString()}`)
        callback(data.toString())
        throw new Error(`Error setting ${productName} port: ${data.toString()}`)
    })
}

/**
 * Calls go-data low level API to retrieve the port number
 * @param callback Invoked with (err, port)
 */
function getDbPort(callback) {
    let log = true // used to stop logging after script exits
    logger.info(`Retrieving ${productName} database port from ${productName} API...`)
    let port = null, error = null
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'get', 'dbPort'])
        .on('exit', (code) => {
            log = false
            logger.info(`${productName} Web 'get dbPort' exited with code ${code}`)
            callback(error, port)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        if (data) {
            let normalizedPort = data.toString().replace(/[\n\t\r]/g, "")
            log && logger.info(`${productName} 'get dbPort' data: ${normalizedPort}`)
            port = normalizedPort
        }
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        if (data) {
            log && logger.error(`${productName} 'get dbPort' error: ${data.toString()}`)
            error = data.toString()
        }
    })
}

/**
 * Calls go-data low level API to set the database port number
 * @param port - The port number to be set
 * @param callback - Invoked with (err, port)
 */
function setDbPort(port, callback) {
    let log = true // used to stop logging after script exits
    logger.info(`Setting ${productName} database port ${port} using ${productName} API...`)
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'set', 'dbPort', port])
        .on('exit', (code) => {
            log = false
            logger.info(`${productName} 'set dbPort ${port}' exited with code ${code}`)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        log && logger.info(`${productName} 'set dbPort ${port}' data: ${data.toString()}`)
        callback(null, data.toString())
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        log && logger.error(`${productName} 'set dbPort ${port}' error: ${data.toString()}`)
        callback(data.toString())
        throw new Error(`Error setting ${productName} database port: ${data.toString()}`)
    })
}

module.exports = {
    getAppPort, setAppPort, getDbPort, setDbPort
}
