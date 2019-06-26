/**
 * Used to run Windows exe files as Windows services
 */

'use strict';

const { exec } = require('child_process')
const sudo = require('sudo-prompt')
const cptable = require('codepage')

const logger = require('./../logger/app').logger
const AppPaths = require('./../utils/paths')

// Windows Service names
const mongoServiceName = "GoDataStorageEngine"
const goDataAPIServiceName = "GoDataAPI"

// Statuses returned by nssm.exe
const nssmStatuses = Object.freeze({
    ServiceNotInstalled: 'The specified service does not exist as an installed service.',
    ServiceAlreadyInstalled: 'The specified service already exists.',
    ServiceStarted: 'START: The operation completed successfully.',
    ServiceStopped: 'SERVICE_STOPPED',
    ServicePaused: 'SERVICE_PAUSED',
    ServiceRunning: 'SERVICE_RUNNING',

    /**
     * @return {string}
     */
    ServiceInstalled: function (options) {
        return `Service "${options.serviceName}" installed successfully!`
    },
    /**
     * @return {string}
     */
    ParameterSet: function (options) {
        return `Set parameter "${options.serviceParameter}" for service "${options.serviceName}".`
    }
})

// nssm.exe encodes results in UTF16
const nssmEncoding = 'utf16le'
let activeCodePage

/**
 * Executes a command using nssm.exe
 * @param command - Array containing the command and additional parameters
 * @param shellOptions
 *     requiresElevation - Whether the command requires elevation to ask for Admin account
 *     serviceName - The name of the windows service
 * @param callback
 */
function runNssmShell(command, shellOptions, callback) {
    // Get active code page once
    if (!activeCodePage) {
        getActiveCodePage((err) => {
            if (err) {
                return callback(err)
            }
            runNssmShell(command, shellOptions, callback)
        })
        return
    }

    shellOptions = shellOptions || {}
    logger.info(`Running NSSM command "nssm.exe ${command.join(' ')}"...`)

    // Used for cases when both stdout and stderr are written to call the callback only once
    let callbackCalled = false

    // Choose whether to run nssm.exe with admin permissions or not
    let executor = shellOptions.requiresElevation ? sudo.exec : exec
    let options = shellOptions.requiresElevation ? {
        name: 'GoData'
    } : null

    let sanitizedCommand = `${AppPaths.nssmFile} ${command.join(' ')}`
    executor(sanitizedCommand, options, (error, stdout, stderr) => {
        if (error && shellOptions.requiresElevation) {
            processNssmResult(true, Buffer.from(error.message))
        } else if (stderr.length > 0) {
            processNssmResult(true, Buffer.from(stderr))
        } else {
            processNssmResult(false, Buffer.from(stdout))
        }
    })

    /**
     * Converts nssm result to string and calls the callback
     * @param isError
     * @param data
     */
    function processNssmResult(isError, data) {
        let result = cptable.utils.decode(activeCodePage, data).replace(/\0.*$/g,'').trim()
        logger.info(`NSSM result:\n${result}`)

        // throw an error unless the error is a valid status
        let status = undefined
        for (let key in nssmStatuses) {
            if (nssmStatuses.hasOwnProperty(key)) {
                let sanitizedStatus = nssmStatuses[key]
                if (typeof nssmStatuses[key] === 'function') {
                    sanitizedStatus = nssmStatuses[key](shellOptions)
                }
                if (result.indexOf(sanitizedStatus) > -1) {
                    status = sanitizedStatus
                    break
                }
            }
        }
        if (!status) {
            logger.info(`Error executing NSSM command "nssm.exe ${command.join(' ')}": ${result}`)
            throw new Error(`Error executing NSSM command "nssm.exe ${command.join(' ')}"`)
        }

        // call callback unless previously called
        if (!callbackCalled) {
            callback(isError ? true : null, status)
            callbackCalled = true
        }
    }
}

/**
 * Calls 'chcp' to determine active code page, parses the result and returns the active code page on callback
 * @param callback
 */
function getActiveCodePage(callback) {
    exec('chcp', (error, stdout, stderr) => {
        if (error || stderr.length > 0) {
            return callback(error || new Error(stderr))
        }
        // parse active code page
        let parsedActiveCodePage = stdout.replace('Active code page: ', '').trim()
        activeCodePage = parseInt(parsedActiveCodePage, 10)
        callback()
    })
}

module.exports = {
    nssmStatuses,
    mongoServiceName,
    goDataAPIServiceName,
    runNssmShell
}