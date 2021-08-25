'use strict';

const {BrowserWindow} = require('electron');
const path = require('path');
const async = require('async');

const AppPaths = require('./../utils/paths');

const ipcMain = require('./../controllers/ipcMain');
const encryptionController = require('./../controllers/encryption');
const settingsController = require('./../controllers/settings');

const appWebApp = require('./web-app');
const appLoading = require('./loading');

const constants = require('./../utils/constants');

let settingsWindow = null;

const {NODE_PLATFORM} = require('./../package');

const platform = process.env.NODE_PLATFORM || NODE_PLATFORM;

/**
 * Opens the settings window
 * @param settingType - SETTINGS_WINDOW_SETTING or SETTINGS_WINDOW_LAUNCH
 *      SETTINGS_WINDOW_SETTING is used to open the settings from the system tray
 *      SETTINGS_WINDOW_LAUNCH is used to open the settings at the initial launch
 */
const openSettings = (settingType) => {
    ipcMain.setState(settingType);
    if (settingsWindow) {
        settingsWindow.show();
        return;
    }
    settingsWindow = new BrowserWindow({
        width: 300,
        height: settingType === constants.SETTINGS_WINDOW_SETTING ? 440 : 430,
        resizable: false,
        center: true,
        frame: settingType === constants.SETTINGS_WINDOW_SETTING,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    settingsWindow.setMenu(null);
    settingsWindow.loadFile(path.join(AppPaths.windowsDirectory, 'settings', 'settings.html'));
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
    settingsWindow.once('ready-to-show', () => {
        appLoading.closePleaseWait();
        settingsWindow.show();
    });
};

/**
 * Configures the IPC Main and handles the events received from IPC Main
 */
const configureIPCMain = () => {
    ipcMain.initSettingsEvents((mongoPort, goDataPort, encryption, state) => {

        // Handle encryption event
        let encryptionProcess = platform === 'win' ?
            (callback) => {
                encryptionController.getDatabaseEncryptionStatus((err, result) => {
                    if (result !== encryption) {
                        // encryption status changed
                        // either encrypt or decrypt the database folder
                        if (encryption) {
                            encryptionController.encryptDatabase(callback);
                        } else {
                            encryptionController.decryptDatabase(callback);
                        }
                    } else {
                        callback();
                    }
                })
            } :
            (callback) => {
                callback();
            };

        // Handle settings saved event
        switch (state) {
            case constants.SETTINGS_WINDOW_LAUNCH:
                setPortsInSettings(true, () => {
                    encryptionProcess(() => {
                        appWebApp.launchGoData(() => {});
                        closeSettings();
                    });
                });
                break;
            case constants.SETTINGS_WINDOW_SETTING:
                setPortsInSettings(false, () => {
                    encryptionProcess(() => {
                        closeSettings();
                    });
                });
                break;
        }

        function setPortsInSettings(immediately, callback) {
            async.series([
                    (callback) => {
                        settingsController.setMongoPort(mongoPort, callback);
                    },
                    (callback) => {
                        settingsController.setAppPort(goDataPort, callback);
                    }
                ],
                callback);
        }
    });
};

/**
 * Closes the settings screen
 */
const closeSettings = () => {
    if (settingsWindow) {
        settingsWindow.close();
        settingsWindow = null;
    }
};

module.exports = {
    openSettings,
    configureIPCMain
};
