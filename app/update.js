'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');

const appLoading = require('./loading');

const updater = require('./../updater/updater');

const formatter = require('./../utils/formatter');
const AppPaths = require('./../utils/paths');
const productName = AppPaths.desktopApp.package.name;

let updateScreen = null;

const configureUpdate = (next) => {
    updater.configureUpdater(
        (event) => {
            let percentage = Math.round(event.percent * 10) / 10;
            if (percentage === 100) {
                updateScreen.webContents.send('event', `Please wait while ${productName} relaunches. This may take a few minutes.`);
            } else {
                updateScreen.webContents.send('event', `Downloading update ${Math.round(event.percent * 10) / 10}% - ${formatter.formatBytes(event.transferred)}/${formatter.formatBytes(event.total)}`);
            }
        },
        (err, updateAvailable) => {
            if (updateAvailable) {
                updateScreen = new BrowserWindow({
                    width: 900,
                    height: 475,
                    resizable: false,
                    center: true,
                    frame: false,
                    show: false,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                });
                updateScreen.loadFile(path.join(AppPaths.windowsDirectory, 'loading', 'index.html'));

                updateScreen.once('ready-to-show', () => {
                    appLoading.closePleaseWait();
                    updateScreen.show();
                });
                updateScreen.webContents.send('event', 'Downloading update...');
            } else {
                next();
            }
        });
};

module.exports = {
    configureUpdate
};
