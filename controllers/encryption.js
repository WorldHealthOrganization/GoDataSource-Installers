'use strict'

const {NODE_PLATFORM} = require('./../package')
const AppPaths = require('./../utils/paths')

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const { spawn } = require('child_process')

const logger = require('./../logger/app').logger

const testEncryptedDummyFile = (callback) => {


    if (process.env.NODE_PLATFORM === 'win' || NODE_PLATFORM === 'win') {
        // create folder in logs folder and attempt to encrypt it
        mkdirp(AppPaths.testEncryptionDirectory, (err) => {
            if (err) {
                callback(err)
                throw err
            }
            logger.info(`Creating dummy encrypted folder...`)

            let result = false;

            const startEncryptionProcess = spawn('cipher', ['/e', AppPaths.testEncryptionDirectory])
            startEncryptionProcess.stdout.on('close', (code) => {
                rimraf(AppPaths.testEncryptionDirectory, () => {
                    callback(null, result);
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
                    result = true;
                }
            })
        })
    } else {
        callback(null, false)
    }
}

const getDatabaseEncryptionStatus = (callback) => {
    if (process.env.NODE_PLATFORM === 'win' || NODE_PLATFORM === 'win') {

        let result = false;

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
                result = true;
            }
        })
    } else {
        callback(null, false)
    }
}

const encryptDatabase = (callback) => {
    changeDatabaseEncryption('/e', callback)
}

const decryptDatabase = (callback) => {
    // call twice because decrypting only once decrypts all files except from the parent folder!
    changeDatabaseEncryption('/d', () => {
        changeDatabaseEncryption('/d', callback)
    })
}

function changeDatabaseEncryption(encryptionFlag, callback) {
    if (process.env.NODE_PLATFORM === 'win' || NODE_PLATFORM === 'win') {

        let result = false;

        const startEncryptionProcess = spawn('cipher', [encryptionFlag, `/s:${AppPaths.appDirectory}`])
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
                result = true;
            }
        })
    } else {
        callback(null, false)
    }
}

module.exports = {
    testEncryptedDummyFile,
    getDatabaseEncryptionStatus,
    encryptDatabase,
    decryptDatabase
}