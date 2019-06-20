'use strict'

const mongo = require('./mongo')
const goData = require('./goData')
const settings = require('./settings')

/**
 * Kills Mongo and GoData processes.
 */
const cleanup = () => {
    mongo.setShouldThrowExceptionOnMongoFailure(false)
    // Mongo process should only be stopped if not running as a service
    !settings.runMongoAsAService && mongo.killMongo()
    goData.killGoData()
}

module.exports = {
    cleanup
}