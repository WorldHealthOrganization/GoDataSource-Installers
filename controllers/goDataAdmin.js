'use strict';

const {spawn} = require('child_process');

const logger = require('./../logger/app').logger;
const AppPaths = require('./../utils/paths');

const goData = require('./goData');
const constants = require('./../utils/constants');

/**
 * Launches the restore backup script
 * @param filePath - The path of the file containing the backup
 * @param callback - Invoked with (errors). Errors is an array of errors.
 */
const restoreBackup = (filePath, callback) => {
    // Stop Go.Data web app
    goData.killGoData((err) => {
        // All errors will be send in callback in an array
        if (err) {
            return callback([{type: constants.GO_DATA_KILL_ERROR}]);
        }

        let infoMessage = 'Restoring backup...';
        let errorMessage = 'Error restoring backup';
        logger.info(infoMessage);

        // run node backupScript.js --file={filePath}
        const restoreBackup = spawn(
            AppPaths.nodeFile,
            [AppPaths.restoreBackupScriptFile, `--file=${filePath}`]
        );

        // log script errors
        restoreBackup.stderr.on('data', (data) => {
            logger.error(`${errorMessage}: ${data.toString()}`);
        });

        restoreBackup.stdout.on('data', (data) => {
            logger.info(data.toString());
        });

        // handle script exit
        restoreBackup.on('close', (code) => {
            // errors may be due to script fail or Go.Data relaunch fail. All of them will be sent in callback
            let errors = [];

            // handle case for script error
            if (code) {
                logger.error(`Backup restore exit with code ${code}`);

                // add error that will be sent in callback
                errors.push({type: constants.GO_DATA_BACKUP_ERROR});
            } else {
                logger.info(`Completed backup restore!`);
            }

            //Relaunch Go.Data web app
            goData.startGoData(
                //events
                () => { },
                //callback
                (error) => {
                    // add launch error to errors if Go.Data launch failed
                    if (error) {
                        errors.add({type: constants.GO_DATA_LAUNCH_ERROR});
                    }
                    callback(errors);
                });
        });
    });
};

/**
 * Launches the reset password script
 * @param callback
 */
const resetAdminPassword = (callback) => {
    let info = 'Reseting Admin password...';
    let error = 'Error reseting Admin password';
    logger.info(info);
    const resetPassword = spawn(
        AppPaths.nodeFile,
        [AppPaths.databaseScriptFile, 'reset-admin-password']
    );
    resetPassword.stderr.on('data', (data) => {
        logger.error(`${error}: ${data.toString()}`);
    });
    resetPassword.on('close', (code) => {
        if (code) {
            logger.error(`Reset Admin password exit with code ${code}`);
        } else {
            logger.info(`Completed reseting admin password`);
        }
        callback(code);
    });
};

module.exports = {
    restoreBackup,
    resetAdminPassword
};
