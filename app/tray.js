'use strict';

const {app, Menu, Tray, dialog, shell} = require('electron');
const path = require('path');

const AppPaths = require('./../utils/paths');

const appLoading = require('./loading');
const appSettings = require('./settings');
const appWebApp = require('./web-app');

const constants = require('./../utils/constants');

const updater = require('./../updater/updater');
const goDataAdmin = require('./../controllers/goDataAdmin');
const cleanup = require('./../controllers/clean-up');

const settings = require('./../controllers/settings');
const mongo = require('./../controllers/mongo');
const goData = require('./../controllers/goData');
const async = require('async');

const productName = AppPaths.desktopApp.package.name;

const logger = require('./../logger/app');

let tray = null;

let serviceOptionsEnabled = false;
const updateTrayMenu = (disableMenu) => {
    // define quit application menu options
    const quitMenuOption = {
        label: `Quit ${productName}`,
        click: quit
    };

    // don't display menu
    if (disableMenu) {
        // disable double click on tray icon
        serviceOptionsEnabled = true;

        // allow only closing app
        tray.setContextMenu(Menu.buildFromTemplate([
            quitMenuOption
        ]));

        // finished
        return;
    }

    // retrieve services information
    async.parallel([
        mongo.isMongoServiceRunning,
        goData.isGoDataServiceRunning
    ], (err, data) => {
        // error checking mongo / node services ?
        // NOTHING to do since we will just consider that these aren't started
        const isMongoServiceRunning = !err && data[0];
        const isNodeServiceRunning = !err && data[1];

        // determine if menu options affected by services should be enabled
        const appUsesServices = settings.runMongoAsAService || settings.runGoDataAPIAsAService;
        serviceOptionsEnabled = !appUsesServices || (isMongoServiceRunning && isNodeServiceRunning);

        // Create the tray options menu
        const menuOptions = [];

        // Option "Open GoData"
        menuOptions.push({
            label: `Open ${productName}`,
            enabled: serviceOptionsEnabled,
            click: openWebApp
        });

        // Options "Reset Password"
        menuOptions.push({
            label: 'Reset Admin Password',
            enabled: serviceOptionsEnabled,
            click: resetAdminPassword
        });

        // Option Restore Backup
        menuOptions.push({
            label: 'Restore Backup',
            enabled: serviceOptionsEnabled,
            click: restoreBackup
        });

        // Option "Settings"
        menuOptions.push({
            type: 'separator'
        }, {
            label: 'Settings',
            click: openSettings
        });

        // Option Stop Start Services
        if (appUsesServices) {
            menuOptions.push({
                type: 'separator'
            }, isMongoServiceRunning || isNodeServiceRunning ? {
                label: 'Stop services',
                click: stopServices
            } : {
                label: 'Start services',
                click: startServices
            });
        }

        // Option Check Updates
        menuOptions.push({
            type: 'separator'
        }, {
            label: 'Check for updates',
            click: checkUpdates
        });

        // Log directories
        menuOptions.push({
            type: 'separator'
        }, {
            label: 'Log directories',
            submenu: [
                {
                    label: 'Application',
                    click: () => {
                        try {
                            shell.openPath(AppPaths.appLogDirectory);
                        } catch (e) {
                            dialog.showMessageBox({
                                type: 'warning',
                                title: '',
                                message: `Couldn't open application logs directory ( "${AppPaths.appLogDirectory}" - "${e.message}" )`,
                                buttons: ['Ok']
                            });
                        }
                    }
                }, {
                    label: 'API',
                    click: () => {
                        try {
                            shell.openPath(AppPaths.webApp.logDirectory);
                        } catch (e) {
                            dialog.showMessageBox({
                                type: 'warning',
                                title: '',
                                message: `Couldn't open api logs directory ( "${AppPaths.webApp.logDirectory}" - "${e.message}" )`,
                                buttons: ['Ok']
                            });
                        }
                    }
                }, {
                    label: 'Database',
                    click: () => {
                        try {
                            shell.openPath(AppPaths.databaseLogDirectory);
                        } catch (e) {
                            dialog.showMessageBox({
                                type: 'warning',
                                title: '',
                                message: `Couldn't open database logs directory ( "${AppPaths.databaseLogDirectory}" - "${e.message}" )`,
                                buttons: ['Ok']
                            });
                        }
                    }
                }
            ]
        });

        // Remove / Don't remove tokens on api server start / restart
        let apiSettings = settings.retrieveAPISettings();
        menuOptions.push({
            type: 'separator'
        }, {
            type: 'checkbox',
            checked: apiSettings.signoutUsersOnRestart,
            label: 'Sign out all users on api restart',
            click: (menuItem) => {
                // retrieve again api settings
                apiSettings = settings.retrieveAPISettings();

                // change "Sign out all users on api restart" flag
                apiSettings.signoutUsersOnRestart = menuItem.checked;

                // save settings
                if (settings.updateAPISettings(apiSettings)) {
                    dialog.showMessageBox({
                        type: 'info',
                        title: 'Sign out users on api server restart',
                        message: apiSettings.signoutUsersOnRestart ?
                            'Users will be signed out on api restart from now one' :
                            'Users won\'t be signed out on api restart from now one',
                        buttons: ['Ok']
                    });
                } else {
                    // restore old value
                    updateTrayMenu();

                    // show error message
                    dialog.showMessageBox({
                        type: 'error',
                        title: '',
                        message: `An error occurred while trying to update api settings. Please check logs.`,
                        buttons: ['Ok']
                    });
                }
            }
        });

        // Option Quit
        menuOptions.push({
            type: 'separator'
        }, quitMenuOption);

        // Set the app tray icon context menu
        tray.setContextMenu(Menu.buildFromTemplate(menuOptions));
    });
};

/**
 * Creates the system tray with the options.
 */
const createTray = () => {
    // Create the system tray
    if (!tray) {
        tray = new Tray(path.join(AppPaths.resourcesDirectory, 'icon.png'));

        // create tray menu
        updateTrayMenu();

        // double click on app tray icon event
        tray.on('double-click', () => {
            if (serviceOptionsEnabled) {
                logger.logger.info('Open web app from createTray...');
                appWebApp.openWebApp();
            }
        });
    }
};

/**
 * Opens Go.Data web app in the default browser
 */
const openWebApp = () => {
    appWebApp.openWebApp();
};

/**
 * Starts the process to reset the Admin password
 */
const resetAdminPassword = () => {
    // Ask user to confirm password reset
    dialog.showMessageBox({
        type: 'warning',
        title: `${productName} Reset Password`,
        message: 'Are you sure you want to reset the current admin password to default?',
        buttons: ['Yes', 'No']
    }).then((data) => {
        if (data.response === 0) {
            appLoading.openPleaseWait();
            // Call Go Data Admin controller to reset Admin password
            goDataAdmin.resetAdminPassword((code) => {
                appLoading.closePleaseWait();
                dialog.showMessageBox({
                    type: code ? 'error' : 'info',
                    title: `${productName} Reset Password`,
                    message: code ? 'An error occurred while resetting the admin password' : 'Admin password was successfully reset.'
                });
            })
        }
    });
};

/**
 * Starts the process to restore back-up from file
 */
const restoreBackup = () => {
    // show file selection dialog
    dialog.showOpenDialog({
        title: 'Select file to restore back-up',
        properties: ['openFile'],
        message: 'Select file to restore back-up'
    }).then((pathsData) => {
        if (
            pathsData &&
            pathsData.filePaths &&
            pathsData.filePaths.length > 0
        ) {
            // Ask user to confirm backup restore
            dialog.showMessageBox({
                type: 'warning',
                title: `${productName} Restore Back-up`,
                message: `${productName} will be unavailable while restoring back-up. Are you sure you want to proceed?`,
                buttons: ['Yes', 'No']
            }).then((data) => {

                // proceed with backup restore
                if (data.response === 0) {

                    appLoading.openPleaseWait();

                    // Call Go Data Admin controller to reset Admin password
                    goDataAdmin.restoreBackup(pathsData.filePaths[0], (errors) => {

                        // set default results to success
                        let type = 'info';
                        let message = 'Back-up was successfully restored.';

                        if (errors.length > 0) {
                            type = 'error';
                            message = '';
                            errors.forEach((e) => {
                                switch (e.type) {
                                    case constants.GO_DATA_KILL_ERROR:
                                        message += `An error occurred while closing ${productName} app. Please try again. `;
                                        break;
                                    case constants.GO_DATA_BACKUP_ERROR:
                                        message += 'An error occurred while restoring back-up. ';
                                        break;
                                    case constants.GO_DATA_LAUNCH_ERROR:
                                        message += `An error occurred while starting ${productName}. `;
                                        break;
                                }
                            })
                        }

                        appLoading.closePleaseWait();

                        // Show result dialog
                        dialog.showMessageBox({
                            type: type,
                            title: `${productName} Restore Back-up`,
                            message: message
                        })
                    })
                }
            })
        } else {
            // cancelled file selection, do nothing
        }
    })
};

/**
 * Opens the settings panel
 */
const openSettings = () => {
    appSettings.openSettings(constants.SETTINGS_WINDOW_SETTING);
};

/**
 * Starts process to check for updates
 */
const checkUpdates = () => {
    updater.setState(constants.UPDATER_STATE_MANUAL);
    updater.checkForUpdates();
};

/**
 * Quits Go.Data
 */
const quit = () => {
    appLoading.openPleaseWait();
    cleanup.cleanup(() => {
        app.quit();
    });
};

/**
 * Start services
 */
const startServices = () => {
    // display loading
    appLoading.openPleaseWait();

    // disable context menu
    updateTrayMenu(true);

    // stop api & mongo services
    async.waterfall([
        settings.getMongoPort,
        mongo.startMongoService,
        (mongoAnswer, callback) => {
            goData.startGoDataAsService(
                () => {},
                callback
            );
        }
    ], (err) => {
        // hide loading
        appLoading.closePleaseWait();

        // an error occurred ?
        if (err) {
            dialog.showMessageBox({
                type: 'error',
                title: `${productName} Stopping services`,
                message: 'An error occurred while trying to stop services'
            });
            return;
        }

        // update context menu
        updateTrayMenu();

        // display electron browser window
        logger.logger.info('Open web app from startServices...');
        openWebApp();
    });
};

/**
 * Stop services
 */
const stopServices = () => {
    dialog.showMessageBox({
        type: 'warning',
        title: `${productName} Stop Services`,
        message: `Are you sure you want to stop ${productName} services?`,
        buttons: ['Yes', 'No']
    }, (buttonIndex) => {
        if (buttonIndex === 0) {
            // display loading
            appLoading.openPleaseWait();

            // disable context menu
            updateTrayMenu(true);

            // close electron browser window
            appWebApp.closeWebApp();

            // stop api & mongo services
            async.series([
                goData.stopGoDataAPIService,
                mongo.stopMongoService
            ], (err) => {
                // hide loading
                appLoading.closePleaseWait();

                // an error occurred ?
                if (err) {
                    dialog.showMessageBox({
                        type: 'error',
                        title: `${productName} Stopping services`,
                        message: 'An error occurred while trying to stop services'
                    });
                    return;
                }

                // update context menu
                updateTrayMenu();
            });
        }
    });
};

module.exports = {
    createTray
};
