'use strict';

const {app, BrowserWindow, dialog} = require('electron');
const path = require('path');
const request = require('request');
const async = require('async');

const goData = require('./../controllers/goData');
const goDataAPI = require('./../controllers/goDataAPI');

const appSplash = require('./splash');

const prelaunch = require('./../controllers/prelaunch');
const mongo = require('./../controllers/mongo');

const AppPaths = require('./../utils/paths');
const productName = AppPaths.desktopApp.package.name;

const logger = require('./../logger/app');

const menu = require('./menu');

const contextMenu = require('electron-context-menu');
contextMenu({
    showSaveImageAs: true
});

// used to cache the app URL after app is loaded
let webAppURL = null;

/**
 * Opens the splash screen
 * Performs Clean-up (kills apps running on Mongo & Go.Data ports)
 * Starts Mongo
 * Starts the Go.Data web app
 * Creates the system tray
 * Closes the splash screen
 * @param callback - Invoked with (err)
 */
const launchGoData = (callback) => {

    appSplash.openSplashScreen();
    appSplash.sendSplashEvent('event', 'Cleaning up...');

    prelaunch.cleanUp(
        () => {
        },
        () => {
            let loadingIndicator = ['⦾', '⦿'];
            let index = 0;
            mongo.init(
                (event) => {
                    if (event.wait) {
                        appSplash.sendSplashEvent('event', 'wait');
                    }
                    if (event.text) {
                        appSplash.sendSplashEvent('event', `${loadingIndicator[(++index) % 2]} ${event.text}`);
                    }
                },
                () => {
                    goData.init(
                        (event) => {
                            if (event.text) {
                                appSplash.sendSplashEvent('event', `${loadingIndicator[(++index) % 2]} ${event.text}`);
                            }
                        },
                        (err, appURL) => {
                            if (err) {
                                appSplash.sendSplashEvent('error', err.message);
                                return callback(err);
                            }
                            logger.logger.info(`Open web app from launchGoData (${appURL})`);
                            openWebApp(appURL);
                            appSplash.closeSplashScreen();
                            const tray = require('./tray');
                            tray.createTray();
                            callback();
                        });
                });
        })
};


/**
 * Opens the appURL in the default browser. If no appURL is provided, it opens localhost on the port that runs the web app.
 * @param appURL - the URL that will open in the web browser
 */
const openWebApp = (appURL) => {
    if (appURL) {
        logger.logger.info(`1. Opening ${productName} at ${appURL}`);
        webAppURL = appURL;
        openEmbeddedWindow(appURL);
    } else if (webAppURL) {
        logger.logger.info(`2. Opening ${productName} at ${webAppURL}`);
        openEmbeddedWindow(webAppURL);
    } else {
        async.parallel([
            // get Protocol
            goDataAPI.getProtocol,
            // get Public Host
            goDataAPI.getPublicHost,
            // get Public Port
            goDataAPI.getPublicPort
        ], (err, results) => {
            if (!err) {
                let url = `${results[0]}://${results[1]}:${results[2]}`;
                logger.logger.info(`3. Opening ${productName} at ${url}`);
                openEmbeddedWindow(url);
            }
        })
    }
};

let embeddedAppWindow;

let openEmbeddedWindowCalledUrl;

/**
 * Checks the app url for 200 status code and opens Go.Data in an Electron window that loads Go.Data Web portal
 * @param url - The URL where Go.Data is running.
 */
const openEmbeddedWindow = (url) => {
    // do we need to wait for previous checkURL to finish since it isn't required anymore ?
    if (openEmbeddedWindowCalledUrl === url) {
        // already in process of opening this url
        logger.logger.info(`Already checking '${url}'...`);
        return;
    } else if (!openEmbeddedWindowCalledUrl) {
        // NOTHING TO DO
        // must open browser window
        logger.logger.info(`Checking '${url}'...`);
    } else if (openEmbeddedWindowCalledUrl !== url) {
        // must wait for async.series to finish
        logger.logger.info(`Waiting for checking '${openEmbeddedWindowCalledUrl}' to finish since url has changed to '${url}'...`);
        setTimeout(
            () => {
                openEmbeddedWindow(url);
            },
            200
        );
        return;
    }

    // determine if we use a secure connection
    // this is the easiest way to check this, since otherwise we would have to change in multiple places and not only where we use openEmbeddedWindow
    const usesSSL = (url || '').toLowerCase().startsWith('https:');

    // validate url
    openEmbeddedWindowCalledUrl = url;
    async.series(
        [
            checkURL,
            openWindow
        ],
        (err) => {
            if (
                err &&
                openEmbeddedWindowCalledUrl === url
            ) {
                //dialog that asks to restart
                const errMsg = `An error occurred while launching ${productName} (${err.message}). Please restart ${productName}.`;
                logger.logger.error(errMsg);
                dialog.showMessageBox({
                    title: `Error`,
                    message: errMsg,
                    buttons: ['Restart', 'Close']
                }, (buttonIndex) => {
                    switch (buttonIndex) {
                        case 0:
                            app.relaunch();
                            app.exit();
                            break;
                        case 1:
                            app.quit();
                            break;
                    }
                });
            } else if (openEmbeddedWindowCalledUrl === url) {
                logger.logger.info('Browser window opened...');
            } else {
                logger.logger.info(`Url changed from '${openEmbeddedWindowCalledUrl}' to '${url}', so there is no point in using the old url...`);
            }

            // reset url caller
            openEmbeddedWindowCalledUrl = undefined;
        }
    );

    // before displaying electron browser window we need to make sure Go.Data api / web works
    function checkURL(callback) {
        // in case contacting api fails, try again later because it could take a while to start the api
        // do this 10 times, if it fails more than that then there is no God and we need to admit that api is down
        async.retry(
            {
                times: 10,
                interval: 3000
            },
            (callback) => {
                // we don't need to check this one since url changed
                if (openEmbeddedWindowCalledUrl !== url) {
                    return callback();
                }

                // determine request data accordingly to protocol
                const requestData = usesSSL ?
                    {
                        url,
                        port: 443,
                        rejectUnauthorized: false,
                        requestCert: true,
                        agent: false
                    } : url;

                // execute request to our url
                request(
                    requestData,
                    (error, response) => {
                        // no response from our api ?
                        if (error || (response && response.statusCode !== 200)) {
                            logger.logger.info(`${url} unreachable`);
                            return callback(new Error(`${url} unreachable`));
                        }

                        // api connection established
                        callback();
                    }
                );
            },
            callback
        );
    }

    // display electron browser window
    function openWindow(callback) {
        // we don't need to display this one since url changed
        if (openEmbeddedWindowCalledUrl !== url) {
            return callback();
        }

        // display browser window
        if (!embeddedAppWindow) {
            embeddedAppWindow = new BrowserWindow({
                webPreferences: {
                    nodeIntegration: false
                },
                show: false,
                icon: path.join(__dirname, './../build/icon.png')
            });

            // maximize window
            embeddedAppWindow.maximize();

            // then show it
            embeddedAppWindow.show();

            // and load the app.
            embeddedAppWindow.loadURL(url);

            // keep name and URL on app title
            embeddedAppWindow.on('page-title-updated', function (event, title) {
                event.preventDefault();
                embeddedAppWindow.setTitle(title);
            });

            // Emitted when the window is closed.
            embeddedAppWindow.on('closed', function () {
                // Dereference the window object, usually you would store windows
                // in an array if your app supports multi windows, this is the time
                // when you should delete the corresponding element.
                embeddedAppWindow = null;
            });

            // replace default electron browser menu with a custom one
            app.setApplicationMenu(menu.getMenu(url));
        } else {
            // maximize window
            embeddedAppWindow.maximize();

            // then show it
            embeddedAppWindow.show();
        }

        // finished configuring browser window
        callback();
    }
};

const closeWebApp = () => {
    if (embeddedAppWindow) {
        embeddedAppWindow.close();
    }
};

module.exports = {
    launchGoData,
    openWebApp,
    closeWebApp
};
