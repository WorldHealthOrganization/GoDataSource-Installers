// Modules to control application life and create native browser window
const {app, dialog} = require('electron');

const {NODE_PLATFORM} = require('./package');
// If the installation is per machine, the data will be saved in the "data" directory in the installation folder
// If the installation is per user, the data will be saved in [WindowsDrive]:\Users\{currentUser}\AppData\Roaming\GoData
// Since there is no way to check if the installation is per user or per machine, we'll consider per user all installations that have the path like \Users\{anythingExceptBackslash}\AppData
const installationFolder = app.getAppPath();
const path = require('path');
const regex = new RegExp('\\\\Users\\\\[^\\\\]+\\\\AppData');
if ((process.env.NODE_PLATFORM === 'win' || NODE_PLATFORM === 'win') &&
    !regex.test(installationFolder)) {
    app.setPath('userData', path.join(app.getAppPath(), '../../../data'));
}

const rl = require('readline');

const appVersion = require('./utils/appVersion');
const AppPaths = require('./utils/paths');
const Migrate = require('./utils/migrate');
const productName = AppPaths.desktopApp.package.name;

const logger = require('./logger/app');
const constants = require('./utils/constants');
const crashReporter = require('./utils/reporter');

const appLoading = require('./app/loading');
const appUpdate = require('./app/update');
const appSplash = require('./app/splash');
const appSettings = require('./app/settings');
const appWebApp = require('./app/web-app');
const fs = require('fs');
const _ = require('lodash');

// set up crash reporter
crashReporter.init();

// Determines if another app instance is running and opens the existing one or launches a new instance
const checkSingletonInstance = () => {
    const shouldQuit = !app.requestSingleInstanceLock();
    if (shouldQuit) {
        logger.logger.info(`Detected previous ${productName} instance, will quit app...`);
        app.quit();
        return true;
    }
    return false;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    // show loading
    appLoading.openPleaseWait();

    // set up logger
    logger.init((err) => {
        if (!err) {
            // log
            logger.logger.info(`Application installed to ${app.getAppPath()}`);
            logger.logger.info(`Application data directory set to ${app.getAppPath()}`);

            // check if we need to merge old windows settings
            try {
                // method used to merge newS into keepS
                let newSettings;
                let currentSettings;
                const mergeJSONMethod = (
                    configOrDatasource,
                    newS,
                    keepS,
                    previousPath
                ) => {
                    _.each(newS, (value, prop) => {
                        // missing value, merge it as it is
                        if (keepS[prop] === undefined) {
                            keepS[prop] = value;
                        } else {
                            // property exists, if object or array we need to merge it recursively without overwriting prop values
                            const fullPropPath = previousPath + `${previousPath ? '.' : ''}${prop}`;
                            if (
                                _.isArray(value) ||
                                _.isObject(value)
                            ) {
                                // check recursively
                                const migrator = _.get(Migrate, `${configOrDatasource}.${fullPropPath}`);
                                if (_.isFunction(migrator)) {
                                    keepS[prop] = migrator(keepS[prop]);
                                } else {
                                    // recursive merge
                                    mergeJSONMethod(
                                        configOrDatasource,
                                        value,
                                        keepS[prop],
                                        fullPropPath
                                    );
                                }
                            } else {
                                // keep old value or migrate
                                const migrator = _.get(Migrate, `${configOrDatasource}.${fullPropPath}`);
                                if (_.isFunction(migrator)) {
                                    keepS[prop] = migrator(keepS[prop]);
                                } else {
                                    // NOTHING TO DO, keep old value
                                }
                            }
                        }
                    });
                };

                // config.json
                if (
                    fs.existsSync(AppPaths.webApp.winOldNewApiCfgPath) &&
                    fs.existsSync(AppPaths.apiConfigPath)
                ) {
                    // merge missing settings
                    logger.logger.info(`Merging API config file "${AppPaths.webApp.winOldNewApiCfgPath}" to "${AppPaths.apiConfigPath}"`);
                    newSettings = JSON.parse(fs.readFileSync(AppPaths.webApp.winOldNewApiCfgPath));
                    currentSettings = JSON.parse(fs.readFileSync(AppPaths.apiConfigPath));
                    mergeJSONMethod(
                        'config',
                        newSettings,
                        currentSettings,
                        ''
                    );
                    logger.logger.info(`Merged finished for "${AppPaths.webApp.winOldNewApiCfgPath}"`);

                    // save the new settings
                    logger.logger.info(`Writing new API settings to "${AppPaths.apiConfigPath}"`);
                    fs.writeFileSync(
                        AppPaths.apiConfigPath,
                        JSON.stringify(
                            currentSettings,
                            null,
                            2
                        )
                    );
                    logger.logger.info(`Finished writing new API settings to "${AppPaths.apiConfigPath}"`);

                    // delete old settings
                    logger.logger.info(`Removing backup API settings from "${AppPaths.webApp.winOldNewApiCfgPath}"`);
                    fs.unlinkSync(AppPaths.webApp.winOldNewApiCfgPath);
                    logger.logger.info(`Finished removing backup API settings from "${AppPaths.webApp.winOldNewApiCfgPath}"`);
                }

                // datasource.json
                if (
                    fs.existsSync(AppPaths.webApp.winOldNewDatasourceCfgPath) &&
                    fs.existsSync(AppPaths.apiDataSourcePath)
                ) {
                    // merge missing settings
                    logger.logger.info(`Merging API datasource file "${AppPaths.webApp.winOldNewDatasourceCfgPath}" to "${AppPaths.apiDataSourcePath}"`);
                    newSettings = JSON.parse(fs.readFileSync(AppPaths.webApp.winOldNewDatasourceCfgPath));
                    currentSettings = JSON.parse(fs.readFileSync(AppPaths.apiDataSourcePath));
                    mergeJSONMethod(
                        'datasource',
                        newSettings,
                        currentSettings,
                        ''
                    );
                    logger.logger.info(`Merged finished for "${AppPaths.webApp.winOldNewDatasourceCfgPath}"`);

                    // save the new settings
                    logger.logger.info(`Writing new API settings to "${AppPaths.apiDataSourcePath}"`);
                    fs.writeFileSync(
                        AppPaths.apiDataSourcePath,
                        JSON.stringify(
                            currentSettings,
                            null,
                            2
                        )
                    );
                    logger.logger.info(`Finished writing new API settings to "${AppPaths.apiDataSourcePath}"`);

                    // delete old settings
                    logger.logger.info(`Removing backup API settings from "${AppPaths.webApp.winOldNewDatasourceCfgPath}"`);
                    fs.unlinkSync(AppPaths.webApp.winOldNewDatasourceCfgPath);
                    logger.logger.info(`Finished removing backup API settings from "${AppPaths.webApp.winOldNewDatasourceCfgPath}"`);
                }
            }
            catch (eImportNewSettings) {
                logger.logger.error(`Error merging new API settings '${eImportNewSettings.message}'`);
            }

            // stop launching app if it is already running
            if (checkSingletonInstance()) {
                return;
            }

            // check for update
            appUpdate.configureUpdate(() => {

                // retrieve version saved on disk to determine if it is first launch or not
                appVersion.getVersion((err, version) => {

                    // configure events for splash screen and settings screens
                    appSettings.configureIPCMain();
                    appSplash.configureIPCMain();

                    // open settings on first launch or launch Go.Data otherwise
                    if (err && err.code === 'ENOENT') {
                        // fresh install, no app version set => open settings
                        appSettings.openSettings(constants.SETTINGS_WINDOW_LAUNCH);
                    } else {
                        appWebApp.launchGoData((err) => { });
                    }
                })
            })
        } else {
            //display error that logger was not initialized
        }
    });

    let readline = rl.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    readline.on('SIGINT', () => {
        process.emit('SIGINT')
    });
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    // if (process.platform !== 'darwin') {
    //     app.quit()
    // }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
});

app.on('will-quit', function () {
    logger.logger.info('App will now quit!')
});

// SSL/TSL: this is the self signed certificate support
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // On certificate error we disable default behaviour (stop loading the page)
    // and we then say "it is all fine - true" to the callback
    event.preventDefault();
    callback(true);
});

// //do something when app is closing
// process.on('exit', () => {
//     // cleanup('EXIT')
// })
//
// //catches ctrl+c event
// process.on('SIGINT', () => {
//     // cleanup('SIGINT')
// })
//
// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', () => {
//     // cleanup('SIGUSR1')
// })
// process.on('SIGUSR2', () => {
//     // cleanup('SIGUSR2')
// })

//catches uncaught exceptions and displays them in the splash screen or a dialog box
process.on('uncaughtException', (exc) => {
    logger.logger.error(`Unhandled exception: ${exc}`);
    if (!appSplash.sendSplashEvent('error', exc.message)) {
        dialog.showMessageBox({
            type: 'error',
            title: `Error`,
            message: `A ${productName} process crashed.\nError: ${exc.message}.\nPlease relaunch ${productName}.`,
            buttons: ['Close']
        }, () => {
            // Force quit the app
            process.exit(-1);
        });
    }
});
