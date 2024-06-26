'use strict';

const {BrowserWindow, app, shell} = require('electron');
const path = require('path');

const ipcMain = require('./../controllers/ipcMain');

const appLoading = require('./loading');

const AppPaths = require('./../utils/paths');
const constants = require('./../utils/constants');

let splashScreen = null;
let visible = false;

/**
 * Opens the Go.Data splash screen with the loading animation
 */
const openSplashScreen = () => {
    splashScreen = new BrowserWindow({
        width: 900,
        height: 475,
        resizable: false,
        center: true,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false
        }
    });
    splashScreen.loadFile(path.join(AppPaths.windowsDirectory, 'loading', 'index.html'));

    splashScreen.on('show', () => {
        visible = true;
    });
    splashScreen.on('closed', () => {
        splashScreen = null;
    });
    splashScreen.once('ready-to-show', () => {
        appLoading.closePleaseWait();
        splashScreen.show();
    });
};

/**
 * Configures the IPC Main and handles the events received from IPC Main
 */
const configureIPCMain = () => {
    ipcMain.initSplashEvents((event) => {
        switch (event) {
            case constants.APP_EXIT:
                app.quit();
                break;
            case constants.OPEN_LOGS:
                shell.openPath(AppPaths.appLogDirectory);
                break;
        }
    });
};

/**
 * Sends an event to the splash screen. The events are handled in the window ipcRenderer function.
 * @param event - Event send to the splash screen
 * @param arg - The arguments send with the event
 * Returns - A boolean value representing if the event has been sent.
 */
const sendSplashEvent = (event, arg) => {
    if (splashScreen && visible) {
        splashScreen.webContents.send(event, arg);
        return true;
    }
    return false;
};

/**
 * Closes the splash screen
 */
const closeSplashScreen = () => {
    if (splashScreen) {
        splashScreen.close();
        splashScreen = null;
    }
};

module.exports = {
    openSplashScreen,
    configureIPCMain,
    sendSplashEvent,
    closeSplashScreen
};
