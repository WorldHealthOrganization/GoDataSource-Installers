'use strict';

/**
 * Cleans up previous instances of Mongo and Go.Data web app.
 * Checks if the Mongo port is in use and kills the process if so.
 * Checks if PM2 Go.Data is online and kills it if so.
 */

const async = require('async');

const logger = require('./../logger/app').logger;

const mongo = require('./mongo');
const goData = require('./goData');
const goDataApi = require('./goDataAPI');
const buildConfiguration = require('./../utils/buildConfiguration');
const settings = require('./settings');

let goDataType = null;
const setBuildConfiguration = (config) => {
    goDataType = config;
};

const cleanUp = (events, callback) => {
    logger.log('Cleaning up...');
    async.series([
            // DO NOT KILL MONGO IF LAUNCHED AS A SERVICE
            (callback) => {
                if (settings.runMongoAsAService) {
                    callback();
                } else {
                    mongo.killMongo(callback);
                }
            },
            // DO NOT KILL GO DATA IF LAUNCHED AS A SERVICE
            (callback) => {
                if (settings.runGoDataAPIAsAService) {
                    callback();
                } else {
                    goData.killGoData(callback);
                }
            },
            goData.setAppPermissions,
            goData.setAppPort,
            goData.setDbPort,
            (callback) => {
                if (!goDataType) {
                    return callback();
                }
                let configuration = buildConfiguration.mapTypeToBuildConfiguration(goDataType);
                goDataApi.setBuildConfiguration(configuration, callback);
            }
        ],
        (err, results) => {
            if (err) {
                logger.error(`Error performing cleanup: ${err.message}`);
            } else {
                logger.info('Completed cleanup!');
            }
            callback(null, results);
        });
};

module.exports = {
    setBuildConfiguration,
    cleanUp
};
