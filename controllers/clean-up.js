'use strict';

const mongo = require('./mongo');
const goData = require('./goData');
const settings = require('./settings');
const async = require('async');

/**
 * Kills Mongo and GoData processes.
 */
const cleanup = (callback) => {
    // set default callback
    callback || (
        callback = () => {}
    );

    // Mongo process should only be stopped if not running as a service
    const jobs = [];
    if (!settings.runMongoAsAService) {
        mongo.setShouldThrowExceptionOnMongoFailure(false);
        jobs.push((callback) => {
            mongo.killMongo(callback);
        });
    }

    // Go.Data process should only be stopped if not running as a service
    if (!settings.runGoDataAPIAsAService) {
        jobs.push((callback) => {
            goData.killGoData(callback);
        });
    }

    // wait for both records to finish
    async.parallel(
        jobs,
        callback
    );
};

module.exports = {
    cleanup
};