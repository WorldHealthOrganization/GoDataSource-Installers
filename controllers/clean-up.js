'use strict';

const mongo = require('./mongo');
const goData = require('./goData');
const settings = require('./settings');

/**
 * Kills Mongo and GoData processes.
 */
const cleanup = (callback) => {
    // set default callback
    if (!callback) {
        callback = () => {};
    }

    // Go.Data process should only be stopped if not running as a service
    const jobs = [];
    if (!settings.runGoDataAPIAsAService) {
        jobs.push((childCallback) => {
            goData.killGoData(childCallback);
        });
    }

    // Mongo process should only be stopped if not running as a service
    if (!settings.runMongoAsAService) {
        mongo.setShouldThrowExceptionOnMongoFailure(false);
        jobs.push((childCallback) => {
            mongo.killMongo(childCallback);
        });
    }

    // there are no jobs to execute ?
    if (jobs.length < 1) {
        callback();
    } else {
        // must wait for all jobs to finish before calling callback
        // can't use async.series / async.parallel because at first error it stops
        const calledJobs = {};
        jobs.forEach((jobCallback, index) => {
            jobCallback((err) => {
                // mark job as called
                calledJobs[index] = err;

                // check if all answers were received
                const jobIndexes = Object.keys(calledJobs);
                if (jobIndexes.length === jobs.length) {
                    // first error is sent further
                    let noError = true;
                    for (let key of jobIndexes) {
                        // do we have an error ?
                        if (calledJobs[key]) {
                            // finished
                            callback(calledJobs[key]);
                            noError = false;
                            break;
                        }
                    }

                    // there are no errors ?
                    if (noError) {
                        callback();
                    }
                }
            });
        });
    }
};

module.exports = {
    cleanup
};