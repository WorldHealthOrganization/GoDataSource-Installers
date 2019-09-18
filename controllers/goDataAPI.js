'use strict';

const {spawn} = require('child_process');
const async = require('async');

const logger = require('./../logger/app').logger;

const AppPaths = require('./../utils/paths');
const productName = AppPaths.desktopApp.package.name;


/**
 * Calls go-data low level API to retrieve the port number
 * @param callback Invoked with (err, port)
 */
function getAppPort(callback) {
    getGoDataParam('apiPort', callback);
}

/**
 * Calls go-data low level API to set the port number
 * @param port - The port number to be set
 * @param callback - Invoked with (err, port)
 */
function setAppPort(port, callback) {
    setGoDataParam('apiPort', port, callback);
}

/**
 * Calls go-data low level API to retrieve the port number
 * @param callback Invoked with (err, port)
 */
function getDbPort(callback) {
    getGoDataParam('dbPort', callback);
}

/**
 * Calls go-data low level API to set the database port number
 * @param port - The port number to be set
 * @param callback - Invoked with (err, port)
 */
function setDbPort(port, callback) {
    setGoDataParam('dbPort', port, callback);
}

/**
 * Calls go-data low level API to retrieve the build number
 * @param callback Invoked with (err, buildNumber)
 */
function getBuildNumber(callback) {
    getGoDataParam('buildNumber', callback);
}

/**
 * Calls go-data low level API to retrieve the build architecture
 * @param callback Invoked with (err, buildArch)
 */
function getBuildArch(callback) {
    getGoDataParam('buildArch', callback);
}

/**
 * Calls go-data low level API to retrieve the protocol
 * @param callback Invoked with (err, protocol)
 */
function getProtocol(callback) {
    getGoDataParam('publicProtocol', callback);
}

/**
 * Calls go-data low level API to retrieve the public host
 * @param callback Invoked with (err, host)
 */
function getPublicHost(callback) {
    getGoDataParam('publicHost', callback);
}

/**
 * Calls go-data low level API to retrieve the public port
 * @param callback Invoked with (err, port)
 */
function getPublicPort(callback) {
    getGoDataParam('publicPort', callback);
}

/**
 * Calls go-data low level API to set the build configuration
 * @param configuration - Object that specifies type and platform: {type: 'hub', platform: 'windows-x86'}
 * @param callback - Invoked with (err)
 */
function setBuildConfiguration(configuration, callback) {
    async.series([
        (callback) => { setGoDataParam('buildPlatform', configuration.platform, callback); },
        (callback) => { setGoDataParam('buildArch', configuration.arch, callback); }
    ],
        callback);
}

/**
 * Calls go-data low level API to retrieve the value of a setting key
 * @param param - a string that specifies the Go.Data API setting key to retrieve its value
 * @param callback Invoked with (err, value)
 */
function getGoDataParam(param, callback) {
    let log = true; // used to stop logging after script exits
    logger.info(`Retrieving ${productName} ${param} from ${productName} API...`);
    let value = null, error = null;
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'get', param])
        .on('exit', (code) => {
            log = false;
            logger.info(`${productName} Web 'get ${param}' exited with code ${code}`);
            callback(error, value);
        });
    goDataConfigProcess.stdout.on('data', (data) => {
        if (data) {
            let normalizedValue = data.toString().replace(/[\n\t\r]/g, "");
            log && logger.info(`${productName} 'get ${param}' data: ${normalizedValue}`);
            value = normalizedValue;
        }
    });
    goDataConfigProcess.stderr.on('data', (data) => {
        if (data) {
            log && logger.error(`${productName} 'get ${param}' error: ${data.toString()}`);
            error = data.toString();
        }
    });
}

/**
 *
 * Calls go-data low level API to set a parameter with the given value
 * @param param - a string that specifies the Go.Data API setting key
 * @param value - a string that specifies the Go.Data API setting value that will be set for the key
 * @param callback - Invoked with (err)
 */
function setGoDataParam(param, value, callback) {
    let log = true; // used to stop logging after script exits
    logger.info(`Setting ${productName} ${param} ${value} using ${productName} API...`);
    const goDataConfigProcess = spawn(AppPaths.nodeFile, [AppPaths.webApp.configScript, 'set', param, value])
        .on('exit', (code) => {
            log = false;
            logger.info(`${productName} 'set ${param} ${value}' exited with code ${code}`);
        });
    goDataConfigProcess.stdout.on('data', (data) => {
        log && logger.info(`${productName} 'set ${param} ${value}' data: ${data.toString()}`);
        callback(null, data.toString());
    });
    goDataConfigProcess.stderr.on('data', (data) => {
        log && logger.error(`${productName} 'set ${param} ${value}' error: ${data.toString()}`);
        // callback(data.toString())
        throw new Error(`Error setting ${productName} ${param}. Please run ${productName} as Administrator.`);
    });
}

module.exports = {
    getAppPort,
    setAppPort,
    getDbPort,
    setDbPort,
    getBuildNumber,
    getBuildArch,
    setBuildConfiguration,
    getProtocol,
    getPublicHost,
    getPublicPort
};
