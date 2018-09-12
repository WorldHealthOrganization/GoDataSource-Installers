'use strict'

const {app} = require('electron')
const path = require('path')
const {spawn, spawnSync} = require('child_process')

const dbDirectory = path.join(app.getPath('userData'), 'db')
const logDirectory = path.join(app.getPath('userData'), 'logs/db')
const logPath = path.join(logDirectory, 'db.log')

const { MONGO_PLATFORM, ARCH, VERSION: OSVERSION } = require('./../package');

const logger = require('./../logger/app').logger

const init = () => {
    configureDb()
    startDb()
}

/**
 * Creates Mongo folders for database (AppData/db) and database logs (AppData/logs/db/db.log) using mkdir
 */
function configureDb() {
    logger.info(`Configuring Mongo database...`)
    const dbPathResult = spawnSync('mkdir', ['-p', `${dbDirectory}`]).stderr.toString()
    if (dbPathResult.length) {
        logger.error(`Error setting log path ${dbDirectory} for Mongo database: ${dbPathResult}`)
        throw new Error(dbPathResult)
    }
    logger.info(`Successfully set database path ${dbDirectory} for Mongo database!`)

    const logPathResult = spawnSync('mkdir', ['-p', `${logDirectory}`]).stderr.toString()
    if (logPathResult.length) {
        logger.error(`Error setting log path ${logDirectory} for Mongo database: ${logPathResult}`)
        throw new Error(logPathResult)
    }
    logger.info(`Successfully set log path ${logDirectory} for Mongo database!`)
}

/**
 * Starts the Mongo database from depending on system configuration
 */
function startDb() {
    let mongodPath = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin/mongod`)
    // Make sure NODE_ENV is set, electron doesn't accept environmental variables
    if (process.env.NODE_ENV === 'development') {
        mongodPath = path.join(__dirname, `./../platforms/${MONGO_PLATFORM}/${ARCH}/${VERSION}/mongodb/bin/mongod`)
    }

    logger.info(`Starting Mongo database from path ${mongodPath} ...`)
    const child = spawn(mongodPath, [`--dbpath=${dbDirectory}`, `--logpath=${logPath}`])

    child.stdout.on('close', (code) => {
        logger.info(`Mongo process exited with code ${code}`)
        if (code) {
            throw new Error(`Mongo process exited with code ${code}`)
        }
    })
}

module.exports = {
    init
}
