/**
 * Cleans up previous instances of Mongo and Go.Data web app.
 * Checks if the Mongo port is in use and kills the process if so.
 * Checks if PM2 Go.Data is online and kills it if so.
 */

'use strict'

const async = require('async')

const logger = require('./../logger/app').logger

const mongo = require('./mongo')
const goData = require('./goData')

const cleanUp = (events, callback) => {
    async.series([
            mongo.killMongo,
            goData.killGoData
        ],
        (err, results) => {
            if (err) {
                logger.error(`Error performing cleanup: ${err.message}`)
            }
            callback(null, results)
        })
}


module.exports = {
    cleanUp
}
