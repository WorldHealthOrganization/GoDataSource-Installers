'use strict'

const {spawn} = require('child_process')

const logger = require('./../logger/app').logger
const AppPaths = require('./../utils/paths')

const goData = require('./goData')

const restoreBackup = (callback) => {
    goData.killGoData((err) => {

    })
    logger.info('Restoring back-up...')
    events({text: 'Migrating database...'})
    const migrateDatabase = spawn(AppPaths.nodeFile, [AppPaths.databaseScriptFile, 'migrate-database', 'from', oldVersion, 'to', newVersion])
    migrateDatabase.stderr.on('data', (data) => {
        logger.error(`Error migrating database: ${data.toString()}`)
        events({text:'Migrating database...', detail: data.toString()})
    })
    migrateDatabase.stdout.on('data', (data) => {
        events({text:'Migrating database...', detail: data.toString()})
    })
    migrateDatabase.on('close', (code) => {
        if (code) {
            events({text: `Error migrating database.\nError log available at ${AppPaths.appLogFile}`})
            callback(code)
        } else {
            logger.info(`Completed migrating database!`)
            events({text: `Completed migrating database...`})
            callback()
        }
    })
}

const resetAdminPassword = (callback) => {
    let info = 'Reseting Admin password...'
    let error = 'Error reseting Admin password'
    logger.info(info)
    const resetPassword = spawn(AppPaths.nodeFile, [AppPaths.databaseScriptFile, 'reset-admin-password'])
    resetPassword.stderr.on('data', (data) => {
        logger.error(`${error}: ${data.toString()}`)
    })
    resetPassword.on('close', (code) => {
        if (code) {
            logger.error(`Reset Admin password exit with code ${code}`)
        } else {
            logger.info(`Completed reseting admin password`)
        }
        callback(code)
    })
}

module.exports = {
    restoreBackup,
    resetAdminPassword
}