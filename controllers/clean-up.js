'use strict'

const mongo = require('./mongo')
const goData = require('./goData')

/**
 * Kills Mongo and GoData processes.
 */
const cleanup = () => {
    mongo.setShouldThrowExceptionOnMongoFailure(false)
    mongo.killMongo()
    goData.killGoData()
}

module.exports = {
    cleanup
}