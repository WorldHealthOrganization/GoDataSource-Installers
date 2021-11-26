'use strict';

const {spawn} = require('child_process');
const async = require('async');
const mkdirp = require('mkdirp');
const kill = require('kill-port');
const Tail = require('tail').Tail;
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const logger = require('./../logger/app').logger;
const processUtil = require('./../utils/process');
const appVersion = require('./../utils/appVersion');
const settings = require('./settings');
const goDataAPI = require('./goDataAPI');
const { nssmValidStatuses, nssmRecoverableStatuses, mongoServiceName, runNssmShell } = require('./nssm');
const AppPaths = require('./../utils/paths');
const databaseDirectory = AppPaths.databaseDirectory;
const logDirectory = AppPaths.databaseLogDirectory;
const DatabaseLogFile = AppPaths.databaseLogFile;
const { MONGO_PLATFORM } = require('./../package');
const { app, BrowserWindow, dialog, clipboard } = require('electron');
const getFolderSize = require('get-folder-size');

/**
 * Configures Mongo (set database path, log path, storage engine, journaling etc)
 * Starts Mongo service
 * Start
 * @param events
 * @param callback
 */
const init = (events, callback) => {
    configureMongo(events, () => {
        startMongo(events, () => {
            startDatabase(events, callback);
        });
    });
};

let shouldThrowExceptionOnMongoFailure = true;
let startMongoProcessIgnoreOutput = false;

/**
 * Specifies whether the app should throw an exception when Mongo crashes. The only time it shouldn't throw an exception is when the Mongo process is forcefully closed in the clean-up operation.
 * @param value - Boolean value
 */
function setShouldThrowExceptionOnMongoFailure(value) {
    shouldThrowExceptionOnMongoFailure = value;
}

/**
 * Creates Mongo folders for database (AppData/db) and database logs (AppData/logs/db/db.log) using mkdir
 */
function configureMongo(events, callback) {
    logger.info('Configuring Mongo database...');
    events({text: 'Configuring Mongo database...'});

    async.parallel([
            (callback) => {
                createDatabaseFolder(events, callback);
            },
            (callback) => {
                createLogFolder(events, callback);
            }
        ],
        callback);

    function createDatabaseFolder(events, callback) {
        mkdirp(databaseDirectory, (err) => {
            if (err) {
                logger.error(`Error setting database path ${databaseDirectory} for Mongo database: ${err.message}`);
                throw err;
            }
            logger.info(`Successfully set database path ${databaseDirectory} for Mongo database!`);
            events({
                text: 'Configuring Mongo database...',
                detail: `Successfully set database path ${databaseDirectory} for Mongo database!`
            });
            callback();
        });
    }

    function createLogFolder(events, callback) {
        mkdirp(logDirectory, (err) => {
            if (err) {
                logger.error(`Error setting log path ${logDirectory} for Mongo database: ${err.message}`);
                throw err;
            }
            logger.info(`Successfully set log path ${logDirectory} for Mongo database!`);
            events({
                text: 'Configuring logging...',
                detail: `Successfully set log path ${logDirectory} for Mongo database!`
            });
            callback();
        });
    }
}

/**
 * Starts the Mongo database depending on system configuration
 */
function startMongo(events, callback) {
    events({
        text: 'Starting database service...',
        detail: `Starting Mongo service from path ${AppPaths.mongodFile} ...`
    });

    settings.getMongoPort((err, port) => {
        if (err) {
            throw new Error(`Error retrieving Mongo port: ${err.message}`)
        }

        // start mongo
        const startMongoServer = () => {
            // start mongo
            if (settings.runMongoAsAService) {
                // Start Mongo as a service - does not need to check the log file because nssm.exe will return the status of the service
                startMongoService(port, (err, status) => {
                    // When the service is already running, it will no longer write in the log file, therefore call the callback here
                    if (status === nssmValidStatuses.ServiceStarted || status === nssmValidStatuses.ServiceRunning) {
                        callback();
                    }
                });
            } else {
                // Mongo does not write to stdout. We will watch the Mongo log file for 'waiting for connections' to determine that the mongo service has started.
                watchMongoStart(events, callback);

                // Start Mongo as integrated process
                startMongoProcess(
                    AppPaths.mongodFile,
                    port
                );
            }
        };

        // do we need to upgrade mongo version ?
        // - if clean install then there is no need to check, just start mongod v5.x
        appVersion.getVersion((err, version) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // fresh install, no need to migrate to new mongo
                    startMongoServer();

                    // finished
                    return;
                } else {
                    throw new Error(`Error reading app version! ${err.message}`);
                }
            }

            // check if version is older which means that we would need to do an upgrade
            // - version < 2.40.0
            const versionDetails  = version.split('.');
            if (versionDetails.length !== 3) {
                throw new Error(`Invalid app version '${version}'`);
            }

            // determine version
            const majorVersion = parseInt(versionDetails[1]);
            let mongodProcess;
            if (majorVersion < 40) {
                // display message
                events({
                    text: 'Must upgrade Mongo DB server from 3.x to 5.x...',
                    detail: ''
                });

                // determine folder size
                getFolderSize(AppPaths.databaseDirectory, (err, size) => {
                    // stop
                    if (err) { throw err; }

                    // folder size
                    const dbFolderSize = (size / 1024 / 1024).toFixed(2) + ' MB';

                    // backup db folder
                    const timestamp = (new Date()).toISOString().slice(0,19).replace(/:/g, '-');
                    const backupDbFolder = `${AppPaths.databaseDirectory}_backup_${timestamp}`;

                    // folder where dump will be performed
                    const dumpDirectory = path.join(
                        AppPaths.appDirectory,
                        '../',
                        `dump-${timestamp}`
                    );

                    // requires confirmation to continue
                    const dialogMsg = `Please copy this information to a file since you will need it later to finish the upgrade process.\n\nMongo upgrade from 3.2 to 5.x is necessary, for this you need ~ 3 x ${dbFolderSize} empty space, please make sure you have the required empty space before continuing. \n\nA backup will be created at the following location '${backupDbFolder}'. \n\nIf this backup exists and in case the upgrade fails please replace '${AppPaths.databaseDirectory}' folder with '${backupDbFolder}' and remove '${dumpDirectory}' if it wasn't removed by the system. \nOtherwise, after confirming that everything works properly you can remove '${backupDbFolder}'.`;
                    const showMigrationDialog = () => {
                        dialog
                            .showMessageBox(
                                new BrowserWindow({
                                    show: false,
                                    alwaysOnTop: true
                                }), {
                                    message: dialogMsg,
                                    type: 'warning',
                                    buttons: [
                                        'Copy information to clipboard',
                                        'Continue',
                                        'Cancel / Close App'
                                    ]
                                }
                            )
                            .then((res) => {
                                // copy information to clipboard ?
                                if (res.response === 0) {
                                    // copy message to clipboard
                                    clipboard.writeText(dialogMsg);

                                    // show confirmation
                                    dialog.showMessageBox(
                                        new BrowserWindow({
                                            show: false,
                                            alwaysOnTop: true
                                        }), {
                                            message: 'Message copied to clipboard',
                                            type: 'info'
                                        }
                                    ).then(() => {
                                        // display dialog
                                        showMigrationDialog();
                                    });

                                    // finished
                                    return;
                                }

                                // close app ?
                                if (res.response === 2) {
                                    // quit app
                                    app.quit();

                                    // finished
                                    return;
                                }

                                // must update mongo version
                                const continueWithUpdatingMongoData = () => {
                                    // something went wrong ?
                                    if (!startMongoProcessIgnoreOutput) {
                                        // prepare directory where we will dump mongodb data
                                        if (fs.existsSync(dumpDirectory)) {
                                            fs.rmdirSync(
                                                dumpDirectory, {
                                                    recursive: true
                                                }
                                            );
                                        }

                                        // finished
                                        return;
                                    }

                                    // no need to ignore output anymore
                                    startMongoProcessIgnoreOutput = false;

                                    // display message
                                    events({
                                        text: 'Creating backup of current mongo 3.x database...'
                                    });

                                    // backup & remove mongod 3.x data folder
                                    fs.rename(
                                        AppPaths.databaseDirectory,
                                        backupDbFolder,
                                        (err) => {
                                            // an error occurred ?
                                            if (err) {
                                                // prepare directory where we will dump mongodb data
                                                if (fs.existsSync(dumpDirectory)) {
                                                    fs.rmdirSync(
                                                        dumpDirectory, {
                                                            recursive: true
                                                        }
                                                    );
                                                }

                                                // an error occurred ?
                                                throw err;
                                            }

                                            // create database dir
                                            fs.mkdirSync(AppPaths.databaseDirectory);

                                            // continue with the rest of the processes (start api, migrate..)
                                            const continueWithStartingAppProperly = () => {
                                                // something went wrong ?
                                                if (!startMongoProcessIgnoreOutput) {
                                                    return;
                                                }

                                                // no need to ignore output anymore
                                                startMongoProcessIgnoreOutput = false;

                                                // create directory where data will be dumped
                                                if (fs.existsSync(dumpDirectory)) {
                                                    fs.rmSync(
                                                        dumpDirectory, {
                                                            recursive: true
                                                        }
                                                    );
                                                }

                                                // display message
                                                events({
                                                    text: 'Finished with success, starting GoData...',
                                                    detail: ''
                                                });

                                                // start app
                                                startMongoServer();
                                            };

                                            // start mongod 5.x database
                                            // - and restore database from dump created with mongo 3.x
                                            watchMongoStart(
                                                () => {
                                                },
                                                (err) => {
                                                    // an error occurred ?
                                                    if (err) {
                                                        // prepare directory where we will dump mongodb data
                                                        if (fs.existsSync(dumpDirectory)) {
                                                            fs.rmdirSync(
                                                                dumpDirectory, {
                                                                    recursive: true
                                                                }
                                                            );
                                                        }

                                                        // finished
                                                        throw err;
                                                    }

                                                    // restore data using mongo 5.x
                                                    const startDbProcess = spawn(
                                                        AppPaths.mongodRestore, [
                                                            `--port=${port}`,
                                                            `${dumpDirectory}`
                                                        ]
                                                    );

                                                    // finished restore ?
                                                    let errorThrown = false;
                                                    startDbProcess.stdout.on('close', () => {
                                                        // didn't finish with success ?
                                                        if (errorThrown) {
                                                            return;
                                                        }

                                                        // stop mongo3
                                                        startMongoProcessIgnoreOutput = true;
                                                        mongodProcess.kill('SIGINT');
                                                    });

                                                    // an error occurred ?
                                                    startDbProcess.stderr.on('data', (data) => {
                                                        // not okay, but we need this hack
                                                        const dataString = data.toString();
                                                        if (dataString.toLowerCase().indexOf('error') < 0) {
                                                            return;
                                                        }

                                                        // stop anything else
                                                        errorThrown = true;

                                                        // log error
                                                        logger.error(dataString);
                                                        throw new Error(dataString);
                                                    });
                                                }
                                            );

                                            // display message
                                            events({
                                                text: 'Restoring database on Mongo DB 5.x server...',
                                                detail: 'Depending of database size it might take some time to finish, please be patient'
                                            });

                                            // start mongod 3.x so we can dump data
                                            mongodProcess = startMongoProcess(
                                                AppPaths.mongodFile,
                                                port,
                                                continueWithStartingAppProperly
                                            );

                                        }
                                    );
                                };

                                // wait for mongod 3.x to start
                                watchMongoStart(
                                    () => {
                                    },
                                    (err) => {
                                        // an error occurred ?
                                        if (err) {
                                            return callback(err);
                                        }

                                        // prepare directory where we will dump mongodb data
                                        if (fs.existsSync(dumpDirectory)) {
                                            fs.rmdirSync(
                                                dumpDirectory, {
                                                    recursive: true
                                                }
                                            );
                                        }

                                        // create directory where data will be dumped
                                        fs.mkdirSync(dumpDirectory);

                                        // display message
                                        events({
                                            text: 'Dumping 3.x database...',
                                            detail: 'Depending of database size it might take some time to finish, please be patient'
                                        });

                                        // dump data using mongod 3.x
                                        const startDbProcess = spawn(
                                            AppPaths.mongod3Dump, [
                                                `--port=${port}`,
                                                `--out=${dumpDirectory}`
                                            ]
                                        );

                                        // finished dump ?
                                        let errorThrown = false;
                                        startDbProcess.stdout.on('close', () => {
                                            // didn't finish with success ?
                                            if (errorThrown) {
                                                // prepare directory where we will dump mongodb data
                                                if (fs.existsSync(dumpDirectory)) {
                                                    fs.rmdirSync(
                                                        dumpDirectory, {
                                                            recursive: true
                                                        }
                                                    );
                                                }

                                                // finished
                                                return;
                                            }

                                            // stop mongo3
                                            startMongoProcessIgnoreOutput = true;
                                            mongodProcess.kill('SIGINT');
                                        });

                                        // an error occurred ?
                                        startDbProcess.stderr.on('data', (data) => {
                                            // not okay, but we need this hack
                                            const dataString = data.toString();
                                            if (dataString.toLowerCase().indexOf('error') < 0) {
                                                return;
                                            }

                                            // stop anything else
                                            errorThrown = true;

                                            // log error
                                            logger.error(dataString);
                                            throw new Error(dataString);
                                        });
                                    }
                                );

                                // start mongod 3.x so we can dump data
                                mongodProcess = startMongoProcess(
                                    AppPaths.mongod3File,
                                    port,
                                    continueWithUpdatingMongoData
                                );
                            })
                            .catch((err) => {
                                // send error further
                                throw err;
                            });
                    };

                    // display dialog
                    showMigrationDialog();
                });
            } else {
                // already updated mongo version
                startMongoServer();
            }
        });
    });
}

/**
 * Starts Mongo on Max & Linux systems using spawn. Results are logged to the Mongo logpath.
 */
function startMongoProcess(
    mongodFile,
    port,
    closeCallback
) {
    let args = [`--dbpath=${databaseDirectory}`, `--logpath=${DatabaseLogFile}`, `--port=${port}`, `--bind_ip=127.0.0.1`];
    logger.info(`Starting Mongo service from path ${mongodFile} with args ${JSON.stringify(args)}`);
    const startDbProcess = spawn(
        mongodFile,
        args
    );

    startDbProcess.stdout.on('close', (code) => {
        // ignore output ?
        if (startMongoProcessIgnoreOutput) {
            // finished
            if (closeCallback) {
                setTimeout(() => {
                    closeCallback();
                });
            }

            // finished
            return;
        }

        if (shouldThrowExceptionOnMongoFailure) {
            throw new Error(`Error: Mongo process exited with code ${code}`);
        }
    });

    startDbProcess.stderr.on('data', (data) => {
        // ignore output ?
        if (startMongoProcessIgnoreOutput) {
            return;
        }

        logger.error(data.toString());
    });

    startDbProcess.stdout.on('data', (data) => {
        // ignore output ?
        if (startMongoProcessIgnoreOutput) {
            return;
        }

        logger.info(data.toString());
    });

    // return process in case we want to do something with it
    return startDbProcess;
}

/**
 * Starts Mongo on Windows as a service using nssm.exe. Results are logged to the Mongo logpath.
 * @param port
 * @param callback(err, status)
 */
function startMongoService(port, callback) {
    checkMongoService((err, status) => {
        switch (status) {
            // service not installed, install service
            case nssmValidStatuses.ServiceNotInstalled:
                installMongoService(port, () => {
                    startMongoService(port, callback)
                });
                break;
            // service in one status that requires just to be started
            case nssmValidStatuses.ServiceAlreadyInstalled:
            case nssmValidStatuses.ServiceStopped:
            case nssmValidStatuses.ServicePaused:
            case nssmValidStatuses.ServiceInstalled({mongoServiceName}):
                launchMongoService(callback);
                break;
            case nssmValidStatuses.ServiceRunning:
                callback(null, status);
                break;

            // RECOVERABLE STATUSES
            case nssmRecoverableStatuses.ServiceUnexpectedStopped:
                uninstallMongoService(() => {
                    // recursive call this function to check again the status
                    startMongoService(port, callback)
                });
                break;

            default:
                callback(new Error(`Error starting Mongo Service! Service returned status ${status}`));
        }
    })
}

/**
 * Checks the Mongo service using nssm.exe.
 * @param callback
 */
function checkMongoService(callback) {
    logger.info('Checking Mongo Service status...');
    let command = ['status', mongoServiceName];
    runNssmShell(command, { requiresElevation: false }, callback);
}

/**
 * Installs Mongo as a service using nssm.exe
 * @param port
 * @param callback
 */
function installMongoService(port, callback) {
    logger.info('Installing Mongo Service...');
    let command = ['install', mongoServiceName, AppPaths.mongodFile, `--dbpath=${databaseDirectory}`, `--logpath=${DatabaseLogFile}`, `--port=${port}`, `--bind_ip=127.0.0.1`];
    runNssmShell(command,  { requiresElevation: true, serviceName: mongoServiceName }, callback);
}

/**
 * Uninstalls Mongo service using nssm.exe
 * @param callback
 */
function uninstallMongoService(callback) {
    logger.info('Uninstalling Mongo Service...');
    let command = ['remove', mongoServiceName, 'confirm'];
    runNssmShell(command,  { requiresElevation: true, serviceName: mongoServiceName }, callback);
}

/**
 * Starts Mongo as a service using nssm.exe
 * @param callback
 */
function launchMongoService(callback) {
    logger.info('Launching Mongo Service...');
    let command = ['start', mongoServiceName];
    runNssmShell(command, { requiresElevation: true }, callback);
}

/**
 * Stop Mongo as a service using nssm.exe
 * @param callback
 */
function stopMongoService(callback) {
    logger.info('Stopping Mongo Service...');
    let command = ['stop', mongoServiceName];
    runNssmShell(command, {requiresElevation: true}, callback);
}

/**
 * Checks the app version and populates or migrates the database.
 * If no app version is detected, the database is populated.
 * If a different app version is detected, the database is migrated.
 */
function startDatabase(events, callback) {
    appVersion.getVersion((err, version) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // fresh install, no app version set => set version and perform population with early exit
                return populateDatabase(events, () => {
                    appVersion.setVersion(callback);
                });
            } else {
                throw new Error(`Error reading app version! ${err.message}`);
            }
        }

        if (version !== AppPaths.webApp.currentVersion) {
            //perform migration
            return migrateDatabase(version, AppPaths.webApp.currentVersion, events, () => {
                appVersion.setVersion(callback);
            });
        }

        return callback();
    })
}

/**
 * Runs node ./go-data/build/server/install/install.js init-database.
 * @param events Function that sends events back to called. Can be called multiple times. Invoked with ({title, details}).
 * @param callback Invoked with no parameter.
 */
function populateDatabase(events, callback) {
    logger.info(`Populating database...`);

    // sent event that database will be populated
    events({wait: true});

    events({text: `Populating database...`});
    const setupDbProcess = spawn(
        AppPaths.nodeFile,
        [AppPaths.databaseScriptFile, 'init-database']
    );
    setupDbProcess.stderr.on('data', (data) => {
        logger.error(`Error populating database: ${data.toString()}`);
        events({text: `Populating database...`, detail: data.toString()});
    });
    setupDbProcess.stdout.on('data', (data) => {
        logger.info(`Populating database: ${data.toString()}`);
        events({text: `Populating database...`, detail: data.toString()});
    });
    setupDbProcess.on('close', (code) => {
        if (code) {
            throw new Error(`Error populating database.\nError log available at ${AppPaths.appLogFile}`);
        } else {
            logger.info(`Completed populating database!`);
            events({text: `Completed populating database...`});
            callback();
        }
    });
}

/**
 * Runs node ./go-data/build/server/install/install.js migrate-database
 * @param oldVersion
 * @param newVersion
 * @param events Function that sends events back to called. Can be called multiple times. Invoked with ({title, details}).
 * @param callback Invoked with no parameter.
 */
function migrateDatabase(oldVersion, newVersion, events, callback) {
    logger.info('Migrating database...');
    events({text: 'Migrating database...'});
    const migrateDatabase = spawn(
        AppPaths.nodeFile,
        [AppPaths.databaseScriptFile, 'migrate-database', 'from', oldVersion, 'to', newVersion]
    );
    migrateDatabase.stderr.on('data', (data) => {
        logger.error(`Error migrating database: ${data.toString()}`);
        events({text: 'Migrating database...', detail: data.toString()});
    });
    migrateDatabase.stdout.on('data', (data) => {
        events({text: 'Migrating database...', detail: data.toString()});
    });
    migrateDatabase.on('close', (code) => {
        if (code) {
            throw new Error(`Error migrating database.\nError log available at ${AppPaths.appLogFile}`);
        } else {
            logger.info(`Completed migrating database!`);
            events({text: `Completed migrating database...`});
            callback();
        }
    });
}

/**
 * Terminates the Mongo process (if any)
 * @param callback Invoked with (err, result)
 */
function killMongo(callback) {
    // set default callback
    if (!callback) {
        callback = () => {};
    }

    logger.info('Attempt to terminate previous Mongo process...');
    goDataAPI.getDbPort((err, port) => {
        if (err) {
            logger.error(`Error reading Mongo port: ${err.message}`);
            // callback()
            throw new Error(`Error reading Mongo port: ${err.message}`);
        }
        if (process.env.MONGO_PLATFORM === 'linux' || MONGO_PLATFORM === 'linux') {
            kill(port)
                .then((result) => {
                    if (result.stderr && result.stderr.length > 0) {
                        logger.error(`Error killing process on port ${port}: ${result.stderr}`);
                        return callback(result.stderr);
                    }
                    logger.info(`Killed process on port ${port}`);
                    callback();
                })
                .catch((e) => {
                    logger.error(`Error killing process on port ${port}: ${e}`);
                    callback(e);
                });
        } else {
            processUtil.findPortInUse(port, (err, processes) => {
                if (processes && processes.length > 0) {
                    // filter out pid 0
                    processes = processes.filter(p => p.pid !== 0 && p.pid !== '0');
                    if (processes && processes.length > 0) {
                        async.each(
                            processes.map(p => p.pid),
                            processUtil.killProcess,
                            callback
                        );
                    } else {
                        callback();
                    }
                } else {
                    callback();
                }
            });
        }
    });
}

/**
 * Watches the mongo log file and waits for 'waiting for connections' to be written to the log file and calls the callback.
 * @param events Function that can be called multiple times to report progress. Invoked with ({title, details}).
 * @param callback Invoked when 'waiting for connections' is written to the Mongo log.
 */
function watchMongoStart(events, callback) {
    // We will use chokidar to scan for changes on the Mongo log file (add, change)
    // When chokidar detects that the mongo log is added, we read it to see if it contains 'waiting for connections' and add a tail listener that
    // When chokidar detects that the mongo log is changed, we only tail the file to see 'waiting for connections' from that point
    let called = false;
    let tail = null;
    let newLog = false;
    const watcher = chokidar.watch(DatabaseLogFile, {
        usePolling: true,
        interval: 1000
    }).on('all', (event) => {
        if (!called) {
            switch (event) {
                case 'add':
                    logger.info(`Detected new Mongo log in ${DatabaseLogFile}`);
                    newLog = true;
                    readMongoLog();
                    tailMongoLog();
                    break;
                case 'change':
                    logger.info(`Detected change in Mongo log in ${DatabaseLogFile}`);
                    tailMongoLog();
                    break;
            }
        }
    }).on('error', (error) => {
        // Handle errors when reading watching the Mongo log for changes.
        // Calls callback with error unless previously called.
        logger.error(`Error watching Mongo log: ${error.message}`);
        if (!called) {
            called = true;
            callback(error);
        }
    });

    // There may be a case where the chokidar 'add' event is not called and 'changed' event is called instead.
    // This will initialize the tail, but it will not receive the line because at this time it will have already been written to file.
    // In this case, we will have a fallback callback that will be called after 1 minute
    setTimeout(() => {
        if (!called) {
            logger.info(`Mongo start event callback not called, fallback to call callback after 180 seconds`);
            called = true;
            callback();
        } else {
            logger.info(`Mongo started, no need for 180 seconds fallback`);
        }
    }, 180000);

    // Removes the watchers from the log file (chokidar) and tail (if any)
    function stopWatchingLogFile() {
        logger.info(`Stopping watch over log file ${DatabaseLogFile}`);
        if (watcher) {
            watcher.unwatch(DatabaseLogFile);
            watcher.close();
        }
        if (tail) {
            tail.unwatch();
        }
    }

    // Reads the log file and looks for 'waiting for connections'
    function readMongoLog() {
        logger.info(`Reading Mongo log ${DatabaseLogFile}...`);
        fs.readFile(DatabaseLogFile, 'utf8', (err, contents) => {
            if (contents.toLowerCase().indexOf('waiting for connections') > -1 && !called) {
                logger.info(`Mongo ready for connections detected while reading ${DatabaseLogFile}`);
                readyForConnections();
            }
        });
    }

    // Listens for changes on the log file and looks for 'waiting for connections' on every new line.
    // In case of failure, calls callback with error, unless previously called.
    function tailMongoLog() {
        if (!tail) {
            //create a read stream from the Mongo log file to detect when the service starts
            tail = new Tail(DatabaseLogFile);

            tail.on('line', (data) => {
                const log = data.toString();
                logger.log(log);
                if (log.toLowerCase().indexOf('waiting for connections') > -1 && !called) {
                    logger.info(`Mongo ready for connections detected while reading line from ${DatabaseLogFile}`);
                    readyForConnections();
                }
            });

            // Handle errors when reading line from Mongo log
            tail.on('error', (err) => {
                logger.error(`Error reading line from Mongo log file ${err.message}`);
                if (!called) {
                    called = true;
                    callback(err);
                }
            });
        }
    }

    // Stops watching the Mongo log file
    // Calls the callback unless previously called
    function readyForConnections() {

        logger.info(`Mongo service successfully started!`);
        events({text: `Mongo service successfully started!`});

        stopWatchingLogFile();
        if (!called) {
            called = true;
            // wait a bit before actually starting the API so DB has time to catch up
            // - not perfect, but would require an entire rewrite otherwise
            setTimeout(() => {
                callback();
            }, 7000);
        }
    }
}

/**
 * Check if mongo service is running
 * @param callback (err, boolean) => {} - True if mongo service is running
 */
function isMongoServiceRunning(callback) {
    // if app doesn't use services then there is no point in saying that the service is running
    if (!settings.runMongoAsAService) {
        callback(null, false);
    } else {
        checkMongoService((err, status) => {
            // did we encounter an error ?
            if (err) {
                return callback(err);
            }

            // check if mongo service is running
            callback(null, status === nssmValidStatuses.ServiceRunning);
        });
    }
}

module.exports = {
    init,
    killMongo,
    setShouldThrowExceptionOnMongoFailure,
    stopMongoService,
    isMongoServiceRunning,
    startMongoService
};
