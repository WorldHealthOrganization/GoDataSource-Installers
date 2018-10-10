/**
 * Sets up mongo configuration (database path and logs path), launches Mongo service, performs database population or migration.
 */

'use strict'

const {spawn, spawnSync} = require('child_process')

const async = require('async')

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
    configureMongo(events)
    startMongo(events, (err) => {
        startDatabase(events, callback)
    })
}

/**
 * Creates Mongo folders for database (AppData/db) and database logs (AppData/logs/db/db.log) using mkdir
 */
function configureMongo(events) {
    logger.info(`Configuring Mongo database...`)
    events({text: `Configuring Mongo database...`})
    const dbPathResult = spawnSync('mkdir', ['-p', `${databaseDirectory}`]).stderr.toString()
    if (dbPathResult.length) {
        logger.error(`Error setting log path ${databaseDirectory} for Mongo database: ${dbPathResult}`)
        throw new Error(dbPathResult)
    }
    logger.info(`Successfully set database path ${databaseDirectory} for Mongo database!`)
    events({detail: `Successfully set database path ${databaseDirectory} for Mongo database!`})

    const logPathResult = spawnSync('mkdir', ['-p', `${logDirectory}`]).stderr.toString()
    if (logPathResult.length) {
        logger.error(`Error setting log path ${logDirectory} for Mongo database: ${logPathResult}`)
        throw new Error(logPathResult)
    }
    logger.info(`Successfully set log path ${logDirectory} for Mongo database!`)
    events({text: `Successfully set log path ${logDirectory} for Mongo database!`})
}

/**
 * Starts the Mongo database from depending on system configuration
 */
function startMongo(events, callback) {
    logger.info(`Starting Mongo service from path ${AppPaths.mongodFile} ...`)
    events({text: `Starting Mongo service from path ${AppPaths.mongodFile} ...`})

    settings.getMongoPort((err, port) => {
        if (err) {
            throw new Error(`Error retrieving Mongo port: ${err.message}`)
        }

        const startDbProcess = spawn(AppPaths.mongodFile, [`--dbpath=${databaseDirectory}`, `--logpath=${DatabaseLogFile}`, `--port=${port}`])

        startDbProcess.stdout.on('close', (code) => {
            throw new Error(`Error: Mongo process exited with code ${code}`)
        })

        logger.info(`Mongo service successfully started!`)
        events({text: `Mongo service successfully started!`})

        callback()

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
    killMongo
}
