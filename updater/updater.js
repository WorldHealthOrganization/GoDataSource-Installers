'use strict';

const electron = require('electron');
const {app, dialog, BrowserWindow} = electron;
const {autoUpdater} = require('electron-updater');

const path = require('path');

const logger = require('../logger/app');
const {ARCH, internalBuild} = require('./../package');
const { UPDATER_STATE_AUTO } = require('./../utils/constants');

let state = UPDATER_STATE_AUTO;

const setState = (newState) => {
    state = newState
};

// Auto-updater tasks
const configureUpdater = (events, callback) => {
    autoUpdater.logger = logger.logger;
    autoUpdater.autoDownload = false;
    if (process.env.NODE_ENV === 'development') {
        autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');
    } else {
        switch (ARCH) {
            case 'x64':
                autoUpdater.updateConfigPath = path.join(__dirname, internalBuild ? 'app-update-x64-internal.yml' : 'app-update-x64.yml');
                break;
        }
    }
    autoUpdater.on('update-available', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Go.Data Updater',
            message: 'A new Go.Data version is available, do you want to update now?',
            buttons: ['Yes', 'No']
        }, (buttonIndex) => {
            if (buttonIndex === 0) {
                autoUpdater.downloadUpdate();
                callback(null, true);
            } else {
                if (state === UPDATER_STATE_AUTO) {
                    callback(null, false);
                }
            }
        })
    });
    autoUpdater.on('update-not-available', () => {
        logger.logger.info('Current version up to date!');
        if (state === UPDATER_STATE_AUTO) {
            callback(null, false);
        } else {
            dialog.showMessageBox({
                title: 'Go.Data Updater',
                message: 'Current version up to date'
            });
        }
    });
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
    autoUpdater.on('download-progress', (ev, progressObj) => {
        events && events(ev);
    });
    autoUpdater.on('update-downloaded', () => {
        app.removeAllListeners('window-all-closed');
        let browserWindows = BrowserWindow.getAllWindows();
        browserWindows.forEach((browserWindow) => {
            browserWindow.removeAllListeners('close');
        });
        setImmediate(() => autoUpdater.quitAndInstall());
    });
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
