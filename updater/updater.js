'use strict';

const electron = require('electron');
const {app, dialog, BrowserWindow} = electron;
const {autoUpdater} = require('electron-updater');

const path = require('path');

const logger = require('../logger/app');
const {ARCH, internalBuild} = require('./../package');
const { UPDATER_STATE_AUTO } = require('./../utils/constants');

const AppPaths = require('./../utils/paths');
const fs = require('fs-extra');
const cleanup = require('./../controllers/clean-up');

let state = UPDATER_STATE_AUTO;

const setState = (newState) => {
    state = newState
};

// Auto-updater tasks
const configureUpdater = (events, callback) => {
    // configure
    autoUpdater.logger = logger.logger;
    autoUpdater.autoDownload = false;

    // configure update check location
    if (process.env.NODE_ENV === 'development') {
        autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');
    } else {
        switch (ARCH) {
            case 'x64':
                autoUpdater.updateConfigPath = path.join(__dirname, internalBuild ? 'app-update-x64-internal.yml' : 'app-update-x64.yml');
                break;
        }
    }

    // update-available
    autoUpdater.on('update-available', (info) => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Go.Data Updater',
            message: `A new Go.Data version is available (version: ${info.version}, release date: ${info.releaseDate}), do you want to update now?`,
            buttons: ['Yes', 'No']
        }).then((data) => {
            if (data.response === 0) {
                autoUpdater.downloadUpdate();
                callback(null, true);
            } else {
                if (state === UPDATER_STATE_AUTO) {
                    callback(null, false);
                }
            }
        })
    });

    // update not available
    autoUpdater.on('update-not-available', (info) => {
        logger.logger.info(`Current version up to date (version: ${info.version}, release date: ${info.releaseDate}) !`);
        if (state === UPDATER_STATE_AUTO) {
            callback(null, false);
        } else {
            dialog.showMessageBox({
                title: 'Go.Data Updater',
                message: 'Current version up to date'
            });
        }
    });

    // error while checking / downloading update...something went wrong
    autoUpdater.on('error', (error) => {
        logger.logger.error(`Updater error: ${error.message}`);
        if (state === UPDATER_STATE_AUTO) {
            callback(null, false);
        } else {
            dialog.showMessageBox({
                title: 'Go.Data Updater',
                message: `Unable to connect to update server (${error.message})`
            });
        }
    });

    // downloading update
    autoUpdater.on('download-progress', (ev, progressObj) => {
        events && events(ev);
    });

    // finished downloading update
    autoUpdater.on('update-downloaded', () => {
        const doTheDeed = () => {
            app.removeAllListeners('window-all-closed');
            let browserWindows = BrowserWindow.getAllWindows();
            browserWindows.forEach((browserWindow) => {
                browserWindow.removeAllListeners('close');
            });
            setImmediate(() => autoUpdater.quitAndInstall());
        };

        // if mac we need to do some backups before proceeding with the upgrade since app directory is immutable
        // which means that files will be removed (backups & storage)
        if (process.platform.toLowerCase() === 'darwin') {
            // update backup path
            const updateBackupPath = path.join(
                AppPaths.appDirectory,
                'update_backup'
            );

            // start the backup process
            fs.exists(updateBackupPath)
                .then((exists) => {
                    // something went wrong with old backup, not perfect, but we need to call the cleanup crew
                    if (exists) {
                        return fs.rmdir(
                            updateBackupPath, {
                                recursive: true
                            }
                        );
                    }
                })
                .then(() => {
                    // create directory where we will do a backup before update
                    return fs.mkdir(
                        updateBackupPath, {
                            mode: '0777'
                        }
                    );
                })
                .then(() => {
                    // stop api & mongo so nothing is written to these folders which would lock the folders
                    return new Promise((resolve) => {
                        cleanup.cleanup(() => {
                            resolve();
                        });
                    });
                })
                .then(() => {
                    // backup backups :)
                    return fs.move(
                        path.join(
                            AppPaths.webApp.directory,
                            'backups'
                        ),
                        path.join(
                            updateBackupPath,
                            'backups'
                        )
                    );
                })
                .then(() => {
                    // backup uploaded files & icons
                    return fs.move(
                        path.join(
                            AppPaths.webApp.directory,
                            'server',
                            'storage'
                        ),
                        path.join(
                            updateBackupPath,
                            'storage'
                        )
                    );
                })
                .then(() => {
                    // close app and start upgrade
                    doTheDeed();
                })
                .catch((error) => {
                    // log
                    logger.logger.error(`Critical error during update: ${error.message}`);

                    // this is bad, update interrupted
                    dialog.showMessageBox({
                        title: 'Go.Data Updater',
                        message: `Critical error during update: ${error.message}`
                    });
                });
        } else {
            // close app and start upgrade
            doTheDeed();
        }
    });

    // check for updates
    checkForUpdates();
};

const checkForUpdates = () => {
    autoUpdater.checkForUpdates();
};

module.exports = {
    configureUpdater,
    checkForUpdates,
    setState
};
