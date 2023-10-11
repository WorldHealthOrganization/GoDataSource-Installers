'use strict';

const {app, BrowserWindow, dialog, Menu} = require('electron');
const path = require('path');
const async = require('async');

const goData = require('./../controllers/goData');
const goDataAPI = require('./../controllers/goDataAPI');
const settings = require('./../controllers/settings');

const appSplash = require('./splash');

const prelaunch = require('./../controllers/prelaunch');
const mongo = require('./../controllers/mongo');

const AppPaths = require('./../utils/paths');
const productName = AppPaths.desktopApp.package.name;

const logger = require('./../logger/app');

const fs = require('fs-extra');

const menu = require('./menu');
const nodeFetch = require('node-fetch');
const https = require('https');

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

    const launch = () => {
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
            });
    };

    // if macOS we need to restore backups and files if there was an upgrade
    if (process.platform.toLowerCase() === 'darwin') {
        // update backup path
        const updateBackupPath = path.join(
            AppPaths.appDirectory,
            'update_backup'
        );

        // check if we have anything to restore
        fs.exists(updateBackupPath)
            .then((exists) => {
                // nothing to do ?
                if (!exists) {
                    return;
                }

                // restore backups
                return fs.exists(path.join(
                    updateBackupPath,
                    'backups'
                )).then((bExists) => {
                    // nothing to do ?
                    if (!bExists) {
                        return;
                    }

                    // restore
                    return fs.move(
                        path.join(
                            updateBackupPath,
                            'backups'
                        ),
                        path.join(
                            AppPaths.webApp.directory,
                            'backups'
                        ), {
                            overwrite: true
                        }
                    );
                }).then(() => {
                    return fs.exists(path.join(
                        updateBackupPath,
                        'storage'
                    ));
                }).then((sExists) => {
                    // nothing to do ?
                    if (!sExists) {
                        return;
                    }

                    // restore
                    return fs.move(
                        path.join(
                            updateBackupPath,
                            'storage'
                        ),
                        path.join(
                            AppPaths.webApp.directory,
                            'server',
                            'storage'
                        ), {
                            overwrite: true
                        }
                    );
                }).then(() => {
                    return fs.exists(path.join(
                        updateBackupPath,
                        'config.json'
                    ));
                }).then((cExists) => {
                    // nothing to do ?
                    if (!cExists) {
                        return;
                    }

                    // restore
                    return fs.move(
                        path.join(
                            updateBackupPath,
                            'config.json'
                        ),
                        path.join(
                            AppPaths.webApp.directory,
                            'server',
                            'config.json'
                        ), {
                            overwrite: true
                        }
                    );
                }).then(() => {
                    return fs.exists(path.join(
                        updateBackupPath,
                        'datasources.json'
                    ));
                }).then((dExists) => {
                    // nothing to do ?
                    if (!dExists) {
                        return;
                    }

                    // restore
                    return fs.move(
                        path.join(
                            updateBackupPath,
                            'datasources.json'
                        ),
                        path.join(
                            AppPaths.webApp.directory,
                            'server',
                            'datasources.json'
                        ), {
                            overwrite: true
                        }
                    );
                }).then(() => {
                    return fs.rmdir(
                        updateBackupPath, {
                            recursive: true
                        }
                    );
                });
            })
            .then(() => {
                launch();
            })
            .catch((error) => {
                // log
                logger.logger.error(`Critical error during update restore backup: ${error.message}`);

                // this is bad, update interrupted
                dialog.showMessageBox({
                    title: 'Go.Data Updater',
                    message: `Critical error during update restore backup: ${error.message}`
                });
            });
    } else {
        launch();
    }
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
                let url = `${results[0]}://${results[1]}${results[2] ? ':' + results[2] : ''}`;
                logger.logger.info(`3. Opening ${productName} at ${url}`);
                openEmbeddedWindow(url);
            }
        })
    }
};

let embeddedAppWindow;
let embeddedAppWindowTimeout;

let openEmbeddedWindowCalledUrl;

/**
 * Checks the app url for 200 status code and opens Go.Data in an Electron window that loads Go.Data Web portal
 * @param url - The URL where Go.Data is running.
 */
const openEmbeddedWindow = (url) => {
    // stop parallel timeout calls
    if (embeddedAppWindowTimeout) {
        clearTimeout(embeddedAppWindowTimeout);
        embeddedAppWindowTimeout = undefined;
    }

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
        embeddedAppWindowTimeout = setTimeout(
            () => {
                embeddedAppWindowTimeout = undefined;
                openEmbeddedWindow(url);
            },
            500
        );
        return;
    }

    // method sued to validate and open electron browser window
    let checkLocalHost = true;
    const checkLocalHostHistory = checkLocalHost;
    const urlHistory = url;
    openEmbeddedWindowCalledUrl = url;
    const validateUrlAndOpenElectronWindow = (err) => {
        // did we get an error while checking that api was started ?
        if (
            err &&
            openEmbeddedWindowCalledUrl === url
        ) {
            // construct error message
            const errMsg = checkLocalHostHistory && !checkLocalHost ?  (
                    `The addresses '${urlHistory}' and '${url}' weren't reachable from the current machine. ` +
                        'Please check that this address is correct and that you do see the Go.Data login page, if not you can try restarting the application.'
                ) : (
                    `The address '${url}' was not reachable from the current machine. ` +
                        'Please check that this address is correct and that you do see the Go.Data login page, if not you can try restarting the application.'
                );

            // log error message
            logger.logger.error(errMsg);

            // try checking for localhost
            if (checkLocalHost) {
                // test the localhost url too
                try {
                    const apiSettings = settings.retrieveAPISettings();
                    if (
                        apiSettings &&
                        apiSettings.port
                    ) {
                        // determine localhost url
                        url = `http://localhost:${apiSettings.port}`;
                        openEmbeddedWindowCalledUrl = url;

                        // reset check localhost
                        checkLocalHost = false;

                        // check the localhost api url - maybe we struck gold
                        checkURL(validateUrlAndOpenElectronWindow);

                        // finished
                        return;
                    }
                } catch(e) {
                    // construct error message
                    let errMsg = 'Error trying to open connection to localhost api';

                    // attach error details
                    if (
                        e &&
                        e.toString
                    ) {
                        errMsg += ` - ${e.toString()}`;
                    }

                    // log error message
                    logger.logger.error(errMsg);
                }
            }

            // display dialog that asks to restart
            dialog.showMessageBox({
                title: 'Error',
                message: errMsg,
                buttons: ['Restart', 'Close']
            }).then((data) => {
                switch (data.response) {
                    case 0:
                        app.relaunch();
                        app.exit();
                        break;
                    case 1:
                        app.quit();
                        break;
                }
            });

            // finished
            openEmbeddedWindowCalledUrl = undefined;
            return;
        }

        // open window
        openWindow(() => {
            // success
            logger.logger.info('Browser window opened...');
            openEmbeddedWindowCalledUrl = undefined;
        });
    }

    // check api url
    checkURL(validateUrlAndOpenElectronWindow);

    // before displaying electron browser window we need to make sure Go.Data api / web works
    function checkURL(callback) {
        // in case contacting api fails, try again later because it could take a while to start the api
        // do this 10 times, if it fails more than that then there is no God and we need to admit that api is down
        async.retry(
            {
                times: 10,
                interval: 1000
            },
            (callback) => {
                // we don't need to check this one since url changed
                if (openEmbeddedWindowCalledUrl !== url) {
                    return callback();
                }

                // tell what url will be tested
                logger.logger.info(`Testing API: '${url}'`);

                // ssl ?
                const usesSSL = (url || '').toLowerCase().startsWith('https:');
                let urlOptions = {
                    method: 'get'
                };
                if (usesSSL) {
                    urlOptions = {
                        method: 'get',
                        agent: new https.Agent({
                            rejectUnauthorized: false
                        })
                    };
                }

                // execute request to our url
                // here url can be both http and https
                nodeFetch(
                    url,
                    urlOptions
                )
                    .then((response) => {
                        // no response from our api ?
                        if (
                            response &&
                            response.status !== 200
                        ) {
                            // construct error message
                            let errMsg = `then: '${url}' unreachable`;

                            // attach status code
                            if (response.status !== undefined) {
                                errMsg += ` - status: ${response.status}`;
                            }

                            // log error message
                            logger.logger.error(errMsg);

                            // return error
                            callback(new Error(errMsg));
                            return;
                        }

                        // api connection established
                        logger.logger.info(`Got response from '${url}'`);
                        callback();
                    })
                    .catch((err) => {
                        // construct error message
                        let errMsg = `catch: '${url}' unreachable`;

                        // attach error details
                        if (
                            err &&
                            err.toString
                        ) {
                            errMsg += ` - ${err.toString()}`;
                        }

                        // log error message
                        logger.logger.error(errMsg);

                        // return error
                        callback(new Error(errMsg));
                    });
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
            Menu.setApplicationMenu(menu.getMenu(url));
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
