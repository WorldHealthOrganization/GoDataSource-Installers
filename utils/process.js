/**
 * Contains utilities to handle OS processes.
 */

'use strict';

const fp = require('find-process');
const ps = require('ps-node');

const logger = require('./../logger/app').logger;

/**
 * Determines whether a port is being used by a process
 * @param port
 * @param callback Invoked with (err, processes)
 */

const findPortInUse = (port, callback) => {
    logger.info(`Searching processes running on port ${port}...`);
    fp('port', port)
        .then(
            (processes) => {
                logger.info(`Retrieved ${processes.length} process(es) running on port ${port}`);
                callback(null, processes);
            },
            (err) => {
                logger.error(`Error retrieving processes running on port ${port}`);
                callback(err);
            })
        .catch((e) => {
            logger.info(e);
            callback(e);
        });
};

/**
 * Terminates a process by pid
 * @param pid - Process Id
 * @param callback - Invoked with (err)
 */
const killProcess = (pid, callback) => {
    logger.info(`Terminating processes with PID ${pid}...`);
    ps.kill(
        pid,
        {
            // send kill -2, includes graceful kill as advised by Mongo
            signal: 'SIGINT'
        },
        (err) => {
            if (err) {
                logger.info(`Error killing process with PID ${pid}: ${err.message}`);
            } else {
                logger.info(`Process with PID ${pid} terminated!`);
            }
            // call callback without err. The process may be killed of not in case of an error, proceed without error.
            callback();
        });
};

module.exports = {
    findPortInUse,
    killProcess
};
