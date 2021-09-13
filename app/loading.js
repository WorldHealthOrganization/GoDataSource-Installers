'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');

const AppPaths = require('./../utils/paths');

let pleaseWaitScreen = null;

/**
 * Opens a loading screen that displays "Please wait..."
 */
const openPleaseWait = () => {
    if (!pleaseWaitScreen) {
        pleaseWaitScreen = new BrowserWindow({
            width: 250,
            height: 120,
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
        pleaseWaitScreen.loadFile(path.join(AppPaths.windowsDirectory, 'please-wait', 'index.html'));

        pleaseWaitScreen.once('ready-to-show', () => {
            pleaseWaitScreen.show();
        });
    } else {
        pleaseWaitScreen.show();
    }
};

/**
 * Closes the loading screen
 */
const closePleaseWait = () => {
    if (pleaseWaitScreen) {
        pleaseWaitScreen.close();
        pleaseWaitScreen = null;
    }
};

module.exports = {
    openPleaseWait,
    closePleaseWait
};
