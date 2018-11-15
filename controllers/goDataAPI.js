'use strict'

const {spawn} = require('child_process')
const async = require('async')

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

/**
 * Calls go-data low level API to retrieve the build configuration
 * @param callback Invoked with (err, buildConfiguration)
 */
function getBuildConfiguration(callback) {
    getBuildConfiguration('build', callback)
}

/**
 * Calls go-data low level API to set the build configuration
 * @param configuration - Object that specifies type and platform: {type: 'hub', platform: 'windows-x86'}
 * @param callback - Invoked with (err)
 */
function setBuildConfiguration(configuration, callback) {
    async.series([
        (callback) => { setGoDataParam('buildType', configuration.type, callback) },
        (callback) => { setGoDataParam('buildPlatform', configuration.platform, callback) }
    ],
        callback)
}

/**
 * Calls go-data low level API to retrieve the value of a setting key
 * @param param - a string that specifies the Go.Data API setting key to retrieve its value
 * @param callback Invoked with (err, value)
 */
function getGoDataParam(param, callback) {
    let log = true // used to stop logging after script exits
    logger.info(`Retrieving ${productName} ${param} from ${productName} API...`)
    let value = null, error = null
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'get', param])
        .on('exit', (code) => {
            log = false
            logger.info(`${productName} Web 'get ${param}' exited with code ${code}`)
            callback(error, value)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        if (data) {
            let normalizedValue = data.toString().replace(/[\n\t\r]/g, "")
            log && logger.info(`${productName} 'get ${param}' data: ${normalizedValue}`)
            value = normalizedValue
        }
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        if (data) {
            log && logger.error(`${productName} 'get ${param}' error: ${data.toString()}`)
            error = data.toString()
        }
    })
}

/**
 * Calls go-data low level API to set a parameter with the given value
 * @param param - a string that specifies the Go.Data API setting key
 * @param value - a string that specifies the Go.Data API setting value that will be set for the key
 * @param callback - Invoked with (err)
 */
function setGoDataParam(param, value, callback) {
    let log = true // used to stop logging after script exits
    logger.info(`Setting ${productName} ${param} ${value} using ${productName} API...`)
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'set', param, value])
        .on('exit', (code) => {
            log = false
            logger.info(`${productName} 'set ${param} ${value}' exited with code ${code}`)
        })
    goDataConfigProcess.stdout.on('data', (data) => {
        log && logger.info(`${productName} 'set ${param} ${value}' data: ${data.toString()}`)
        callback(null, data.toString())
    })
    goDataConfigProcess.stderr.on('data', (data) => {
        log && logger.error(`${productName} 'set ${param} ${value}' error: ${data.toString()}`)
        callback(data.toString())
        throw new Error(`Error setting ${productName} ${param}: ${data.toString()}`)
    })
}

module.exports = {
    getAppPort,
    setAppPort,
    getDbPort,
    setDbPort,
    getBuildConfiguration,
    setBuildConfiguration
}
