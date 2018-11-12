'use strict'

const {NODE_PLATFORM} = require('./../package')
const AppPaths = require('./../utils/paths')

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const {spawn} = require('child_process')

const logger = require('./../logger/app').logger

const architecture = process.env.NODE_PLATFORM || NODE_PLATFORM

/**
 * Determines whether a Windows machine has encryption capability by creating a test folder and attempting to encrypt it with the 'cipher' command
 * @param callback - Invoked with (err, result). Result is a boolean value with the success of the encryption operation.
 */
const testEncryptedDummyFile = (callback) => {

    if (process.env.NODE_PLATFORM === 'win' || NODE_PLATFORM === 'win') {
        // create folder in logs folder and attempt to encrypt it
        mkdirp(AppPaths.testEncryptionDirectory, (err) => {
            if (err) {
                callback(err)
                throw err
            }
            logger.info(`Creating dummy encrypted folder...`)

            let result = false

            const startEncryptionProcess = spawn('cipher', ['/e', AppPaths.testEncryptionDirectory])
            startEncryptionProcess.stdout.on('close', (code) => {
                rimraf(AppPaths.testEncryptionDirectory, () => {
                    callback(null, result)
                })
            })

            startEncryptionProcess.stderr.on('data', (data) => {
                logger.error(data.toString())
            })

            startEncryptionProcess.stdout.on('data', (data) => {
                let message = data.toString()
                logger.info(message)
                if (message.indexOf('[OK]') !== -1) {
                    // successfully encrypted test folder
                    result = true
                }
            })
        })
    } else {
        callback(null, false)
    }
}

/**
 * Determines whether the application folder is encrypted or not. It runs the 'cipher' command on Windows and the 'fdesetup' command on OSX.
 * @param callback - Invoked with (err, result) Result is a boolean value with the the encryption status of the application folder.
 */
const getDatabaseEncryptionStatus = (callback) => {

    let architecture = process.env.NODE_PLATFORM || NODE_PLATFORM

    switch (architecture) {
        case 'win':
            getWinEncStatus(callback)
            break
        case 'darwin':
            getMacEncStatus(callback)
            break
    }

    function getWinEncStatus(callback) {
        let result = false
        const startEncryptionProcess = spawn('cipher', ['/c', AppPaths.appDirectory])
        startEncryptionProcess.stdout.on('close', (code) => {
            callback(null, result)
        })
        startEncryptionProcess.stderr.on('data', (data) => {
            logger.error(data.toString())
        })
        startEncryptionProcess.stdout.on('data', (data) => {
            let message = data.toString()
            logger.info(message)
            if (message.startsWith(`E ${AppPaths.appDirectory.split('\\').pop()}`)) {
                // folder is encrypted
                result = true
            }
        })
    }

    function getMacEncStatus(callback) {
        let result = false
        const startEncryptionProcess = spawn('fdesetup', ['status'])
        startEncryptionProcess.stdout.on('close', (code) => {
            callback(null, result)
        })
        startEncryptionProcess.stderr.on('data', (data) => {
            logger.error(data.toString())
        })
        startEncryptionProcess.stdout.on('data', (data) => {
            let message = data.toString()
            logger.info(message)
            if (message.indexOf('FileVault') > -1 && message.indexOf('On') > -1) {
                // FileVault is enabled
                result = true
            }
        })
    }
}

const encryptDatabase = (callback) => {
    changeDatabaseEncryption(true, callback)
}

const decryptDatabase = (callback) => {
    changeDatabaseEncryption(false, (err, result) => {
        if (architecture === 'win') {
            // call twice on windows because decrypting only once decrypts all files except from the parent folder!
            changeDatabaseEncryption(false, callback)
        } else {
            callback(err, result)
        }
    })
}

function changeDatabaseEncryption(encryptionFlag, callback) {

    switch (architecture) {
        case 'win':
            changeWinDbEnc(callback)
            break
        case 'darwin':
            changeMacDbEnc(callback)
            break
        default:
            callback(null, false)
            break
    }

    function changeWinDbEnc(callback) {
        let result = false

        const startEncryptionProcess = spawn('cipher', [encryptionFlag ? '/e' : '/d', `/s:${AppPaths.appDirectory}`])
        startEncryptionProcess.stdout.on('close', (code) => {
            callback(null, result)
        })

        startEncryptionProcess.stderr.on('data', (data) => {
            logger.error(data.toString())
        })

        startEncryptionProcess.stdout.on('data', (data) => {
            let message = data.toString()
            logger.info(message)
            if (message.indexOf('[OK]' > -1)) {
                // successfully encrypted test folder
                result = true
            }
        })
    }

    function changeMacDbEnc(callback) {
        let result = false

        let osaScriptArgs = [
            '-e', 'tell application "System Preferences"',
            '-e', 'activate',
            '-e', 'set current pane to pane id "com.apple.preference.security"',
            '-e', 'delay 1',
            '-e', 'tell application "System Events"',
            '-e', 'click radio button "FileVault" of tab group 1 of window "Security & Privacy" of application process "System Preferences"',
            '-e', 'end tell',
            '-e', 'end tell'
        ]

        const startEncryptionProcess = spawn('osascript', osaScriptArgs)

        startEncryptionProcess.stdout.on('close', (code) => {
            callback(null, result)
        })

        startEncryptionProcess.stderr.on('data', (data) => {
            logger.error(data.toString())
        })

        startEncryptionProcess.stdout.on('data', (data) => {
            let message = data.toString()
            logger.info(message)
            if (message.indexOf('[OK]' > -1)) {
                // successfully encrypted test folder
                result = true
            }
        })
    }
}

module.exports = {
    testEncryptedDummyFile,
    getDatabaseEncryptionStatus,
    encryptDatabase,
    decryptDatabase
}
