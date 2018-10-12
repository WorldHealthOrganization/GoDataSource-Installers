/**
 * Sets up mongo configuration (database path and logs path), launches Mongo service, performs database population or migration.
 */

'use strict'

const {spawn, spawnSync} = require('child_process')

const async = require('async')
const mkdirp = require('mkdirp')

const logger = require('./../logger/app').logger
const processUtil = require('./../utils/process')
const appVersion = require('./../utils/appVersion')
const settings = require('./settings')
const goDataAPI = require('./goDataAPI')

const AppPaths = require('./../utils/paths')

const databaseDirectory = AppPaths.databaseDirectory
const logDirectory = AppPaths.databaseLogDirectory
const DatabaseLogFile = AppPaths.databaseLogFile

const init = (events, callback) => {
    configureMongo(events, (err) => {
        startMongo(events, (err) => {
            startDatabase(events, callback)
        })
    })
}

let shouldThrowExceptionOnMongoFailure = true;
function setShouldThrowExceptionOnMongoFailure(value) {
    shouldThrowExceptionOnMongoFailure = value
}

/**
 * Creates Mongo folders for database (AppData/db) and database logs (AppData/logs/db/db.log) using mkdir
 */
function configureMongo(events, callback) {
    logger.info(`Configuring Mongo database...`)
    events({text: `Configuring Mongo database...`})

    async.parallel([
            (callback) => {
                createDatabaseFolder(events, callback)
            },
            (callback) => {
                createLogFolder(events, callback)
            }
        ],
        callback)

    function createDatabaseFolder(events, callback) {
        mkdirp(databaseDirectory, (err) => {
            if (err) {
                logger.error(`Error setting database path ${databaseDirectory} for Mongo database: ${err.message}`)
                throw err
            }
            logger.info(`Successfully set database path ${databaseDirectory} for Mongo database!`)
            events({detail: `Successfully set database path ${databaseDirectory} for Mongo database!`})
            callback()
        })
    }

    function createLogFolder(events, callback) {
        mkdirp(logDirectory, (err) => {
            if (err) {
                logger.error(`Error setting log path ${logDirectory} for Mongo database: ${err.message}`)
                throw err
            }
            logger.info(`Successfully set log path ${logDirectory} for Mongo database!`)
            events({detail: `Successfully set log path ${logDirectory} for Mongo database!`})
            callback()
        })
    }
}

/**
 * Starts the Mongo database from depending on system configuration
 */
function startMongo(events, callback) {
    logger.info(`Starting Mongo service from path ${AppPaths.mongodFile} with args --dbpath=${databaseDirectory} --logpath=${DatabaseLogFile}...`)
    events({
        text: 'Startig database service...',
        detail: `Starting Mongo service from path ${AppPaths.mongodFile} ...`
    })

    settings.getMongoPort((err, port) => {
        if (err) {
            throw new Error(`Error retrieving Mongo port: ${err.message}`)
        }

        let args = [`--dbpath=${databaseDirectory}`, `--logpath=${DatabaseLogFile}`, `--port=${port}`]
        if (process.env.ARCH === 'x86' && process.env.PLATFORM === 'win') {
            args.push(`--storageEngine=mmapv1`)
        }
        const startDbProcess = spawn(AppPaths.mongodFile, args)

        startDbProcess.stdout.on('close', (code) => {
            if (shouldThrowExceptionOnMongoFailure) {
                throw new Error(`Error: Mongo process exited with code ${code}`)
            }
        })

        startDbProcess.stderr.on('data', (data) => {
            logger.error(data.toString())
        })

        startDbProcess.stdout.on('data', (data) => {
            logger.info(data.toString())
        })

        setTimeout(() => {
            logger.info(`Mongo service successfully started!`)
            events({text: `Mongo service successfully started!`})
            callback()
        }, 1000)

    })
}

/**
 * Checks the app version and populates or migrates the database.
 * If no app version is detected, the database is populated.
 * If a different app version is detected, the database is migrated.
 */
function startDatabase(events, callback) {
    appVersion.getVersion((err, version) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // fresh install, no app version set => set version and perform population with early exit
                return populateDatabase(events, () => {
                    appVersion.setVersion(callback)
                })
            } else {
                throw new Error(`Error reading app version! ${err.message}`)
            }
        }

        if (version !== AppPaths.webApp.currentVersion) {
            //perform migration
            return migrateDatabase(events, callback)
        }

        return callback()
    })
}

/**
 * Runs node ./go-data/build/server/install/install.js init-database
 */
function populateDatabase(events, callback) {
    logger.info(`Populating database...`)
    events({text: `Populating database...`})
    const setupDbProcess = spawn(AppPaths.nodeFile, [AppPaths.databaseScriptFile, 'init-database'])
    setupDbProcess.stderr.on('data', (data) => {
        logger.error(`Error populating database: ${data.toString()}`)
        events({detail: data.toString()})
    })
    setupDbProcess.stdout.on('data', (data) => {
        logger.info(`Populating database: ${data.toString()}`)
        events({detail: data.toString()})
    })
    setupDbProcess.stdout.on('close', (code) => {
        logger.info(`Completed populating database!`)
        events({text: `Completed populating database...`})
        callback()
    })
}

/**
 * Runs node ./go-data/build/server/install/install.js migrate-database
 */
function migrateDatabase(events, callback) {
    logger.info(`Migrating database...`)
    events({text: `Migrating database...`})
    const migrateDatabase = spawn(AppPaths.nodeFile, [AppPaths.databaseScriptFile, 'migrate-database'])
    migrateDatabase.stdout.on('data', (data) => {
        events({detail: data.toString()})
    })
    migrateDatabase.stdout.on('close', (code) => {
        callback()
    })
}

/**
 * Terminates the Mongo process (if any)
 * @param callback Invoked with (err, result)
 */
function killMongo(callback) {

    callback || (callback = () => {})

    logger.info('Attempt to terminate previous Mongo process...')
    goDataAPI.getDbPort((err, port) => {
        if (err) {
            logger.error(`Error reading Mongo port: ${err.message}`)
            callback()
            throw new Error(`Error reading Mongo port: ${err.message}`)
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
}

module.exports = {
    init,
    killMongo,
    setShouldThrowExceptionOnMongoFailure
}
