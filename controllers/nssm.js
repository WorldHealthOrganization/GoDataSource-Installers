/**
 * Used to run Windows exe files as Windows services
 */

'use strict';

// Windows Service names
const mongoServiceName = "GoDataStorageEngine"
const goDataAPIServiceName = "GoDataAPI"

// Statuses returned by nssm.exe
const nssmStatuses = Object.freeze({
    ServiceNotInstalled: 'The specified service does not exist as an installed service.',
    ServiceAlreadyInstalled: 'The specified service already exists.',
    ServiceInstalled: `Service "${mongoServiceName}" installed successfully!`,
    ServiceDirectorySet: `Set parameter "AppDirectory" for service "${mongoServiceName}".`,
    ServiceStarted: 'START: The operation completed successfully.',
    ServiceStopped: 'SERVICE_STOPPED',
    ServicePaused: 'SERVICE_PAUSED',
    ServiceRunning: 'SERVICE_RUNNING'
})

// nssm.exe encodes results in UTF16
const nssmEncoding = 'utf16le'

/**
 * Executes a command using nssm.exe
 * @param command - Array containing the command and additional parameters
 * @param requiresElevation - Whether the command requires elevation to ask for Admin account
 * @param callback
 */
function runNssmShell(command, requiresElevation, callback) {
    logger.info(`Running NSSM command "nssm.exe ${command.join(' ')}"...`)

    // Used for cases when both stdout and stderr are written to call the callback only once
    let callbackCalled = false

    // Choose whether to run nssm.exe with admin permissions or not
    let executor = requiresElevation ? sudo.exec : exec
    let options = requiresElevation ? {
        name: 'GoData'
    } : null

    let sanitizedCommand = `${AppPaths.nssmFile} ${command.join(' ')}`
    executor(sanitizedCommand, options, (error, stdout, stderr) => {
        if (error && requiresElevation) {
            processNssmResult(true, Buffer.from(error.message))
        } else if (stderr.length > 0) {
            processNssmResult(true, Buffer.from(stderr))
        } else {
            processNssmResult(false, Buffer.from(stdout))
        }
    })

    // nssmShellProcess.stdout.on('data', (data) => processNssmResult(false, data))
    // nssmShellProcess.stderr.on('data', (data) => processNssmResult(true, data))

    /**
     * Converts nssm result to string and calls the callback
     * @param isError
     * @param data
     */
    function processNssmResult(isError, data) {
        let result = data.toString(nssmEncoding)
        logger.info(`NSSM result: ${result}`)

        // throw an error unless the error is a valid status
        let status = undefined
        for (let key in nssmStatuses) {
            if (nssmStatuses.hasOwnProperty(key)) {
                if (result.indexOf(nssmStatuses[key]) > -1) {
                    status = nssmStatuses[key]
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

module.exports = {
    nssmStatuses,
    mongoServiceName,
    goDataAPIServiceName,
    runNssmShell
}