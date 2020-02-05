'use strict';

/**
 * Creates the {userData}/.settings file and writes settings to it.
 */

const fs = require('fs');

const AppPaths = require('./../utils/paths');
const settingsFile = AppPaths.desktopApp.settingsFile;
const winCfgPath = AppPaths.desktopApp.winCfgPath;
const apiConfigPath = AppPaths.apiConfigPath;

const encryptionController = require('./encryption');

const logger = require('./../logger/app').logger;
const { NODE_PLATFORM, MONGO_PLATFORM } = require('./../package');

/**
 * Reads the .settings file and returns the JSON parsed content as object.
 * @param callback - invoked with (err, getVersion)
 */
const getSettings = (callback) => {
    fs.readFile(settingsFile, (err, data) => {
        if (err) return callback(err);
        let settings = JSON.parse(data.toString());
        callback(null, settings);
    });
};

/**
 * Creates the .settings file with JSON content
 * @param settings
 * @param callback
 */
const setSettings = (settings, callback) => {
    try {
        let setting = JSON.stringify(settings);
        fs.writeFile(settingsFile, setting, (err) => {
            if (err) {
                logger.info(`Error writing settings file: ${err.message}`);
                return callback(err);
            }
            logger.info(`Successfully wrote settings file.`);
            callback();
        });
    } catch (e) {
        callback(e);
    }
};

/**
 * If the application port is cached, it is sent in callback. Otherwise, the .settings file is read and the value of `apiPort` is sent in the callback.
 * @param callback - invoked with (err, port)
 */
let appPort = null;
const getAppPort = (callback) => {
    if (appPort) {
        return callback(null, appPort);
    }
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                appPort = 8000;
                return callback(null, appPort);
            } else {
                // callback(null, null)
                throw new Error(`Error getting application port: ${err.message}`);
            }
        }
        appPort = settings.appPort || 8000;
        callback(null, appPort);
    });
};

/**
 * Reads the .settings file, sets the port and writes back the .settings file
 * @param port
 * @param callback - Invoked with (err)
 */
const setAppPort = (port, callback) => {
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                settings = {};
            } else {
                // return callback(err, null)
                throw new Error(`Error setting application port: ${err.message}`);
            }
        }
        appPort = port;
        settings.appPort = port;
        logger.info(`Writing App Port to settings file...`);
        setSettings(settings, callback);
    });
};

/**
 * Reads the .settings file and returns `mongoPort` variable
 * @param callback - invoked with (err, port)
 */
let mongoPort = null;
const getMongoPort = (callback) => {
    if (mongoPort) {
        return callback(null, mongoPort);
    }
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                mongoPort = 27017;
                return callback(null, mongoPort);
            } else {
                // callback(null, null)
                throw new Error(`Error setting Mongo port: ${err.message}`);
            }
        }
        mongoPort = settings.mongoPort || 27017;
        callback(null, mongoPort);
    });
};

/**
 * Reads the .settings file, sets the port and writes back the .settings file
 * @param port
 * @param callback - Invoked with (err)
 */
const setMongoPort = (port, callback) => {
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                settings = {};
            } else {
                // return callback(err, null)
                throw new Error(`Error setting Mongo port: ${err.message}`);
            }
        }
        mongoPort = port;
        settings.mongoPort = port;
        logger.info(`Writing Mongo Port to settings file...`);
        setSettings(settings, callback);
    });
};

/**
 * Reads the .settings file and returns `encryptionCapability` variable
 * @param callback - invoked with (err, capable)
 */
let encryptionCapability = null;
const getEncryptionCapability = (callback) => {
    if (encryptionCapability) {
        return callback(null, encryptionCapability);
    }
    getSettings((err, settings) => {
        if (settings && settings.encryptionCapability) {
            encryptionCapability = settings.encryptionCapability;
            return callback(null, encryptionCapability);
        }
        let platform = process.env.NODE_PLATFORM || NODE_PLATFORM;
        switch (platform) {
            case 'win':
                encryptionController.testEncryptedDummyFile((err, capable) => {
                    encryptionCapability = capable;
                    setEncryptionCapability(capable, (err) => {
                        callback(err, capable);
                    });
                });
                break;
            case 'darwin':
                callback(null, true);
                break;
            default:
                callback(null, false);
                break;
        }
    });
};

/**
 * Reads the .settings file, sets the encryption capability and writes back the .settings file
 * @param capable
 * @param callback - Invoked with (err)
 */
const setEncryptionCapability = (capable, callback) => {
    getSettings((err, settings) => {
        if (err) {
            if (err.code === 'ENOENT') {
                settings = {};
            } else {
                return callback(err, null);
            }
        }
        encryptionCapability = capable;
        settings.encryptionCapability = capable;
        logger.info(`Writing encryption capability to settings file...`);
        setSettings(settings, callback);
    });
};

/**
 * Retrieve win settings
 * Props: {
 *  installationTypeUseServices: '0' | '1'
 * }
 */
let cachedWinSettings;
const retrieveWinSettings = () => {
    // no win settings ?
    if (!winCfgPath) {
        return {};
    }

    // check if we didn't loaded already
    if (cachedWinSettings) {
        return cachedWinSettings;
    }

    // load settings
    cachedWinSettings = {};
    try {
        // check if win config file exists and
        if (fs.existsSync(winCfgPath)) {
            // read win settings
            const winCfgData = fs.readFileSync(winCfgPath, 'utf8');

            // determine if we should use services or not
            const reg = /^\s*([a-z0-9]+)\s*=\s*([a-z0-9])\s*$/igm;
            const regCheck = winCfgData || '';
            let m;
            do {
                m = reg.exec(regCheck);
                if (m) {
                    cachedWinSettings[m[1]] = m[2];
                }
            } while (m);
        }
    } catch (e) {
        // NOTHING
    }

    // finished loading win settings
    return cachedWinSettings;
};

/**
 * Retrieve api settings ( config.json )
 */
const retrieveAPISettings = () => {
    // no api settings ?
    if (!apiConfigPath) {
        return {};
    }

    // load settings
    let apiConfig = {};
    try {
        // check if api config file exists and
        if (fs.existsSync(apiConfigPath)) {
            // read api settings
            const apiConfigData = fs.readFileSync(apiConfigPath, 'utf8');
            apiConfig = JSON.parse(apiConfigData);
        }
    } catch (e) {
        // NOTHING
    }

    // finished loading api settings
    return apiConfig;
};

/**
 * Update api settings ( config.json )
 * @return {boolean} True if saved with success, false otherwise
 */
const updateAPISettings = (settings) => {
    // no api settings ?
    if (!apiConfigPath) {
        return false;
    }

    // convert settings to string if necessary
    settings = typeof settings === 'string' ?
        settings :
        JSON.stringify(settings, null, 2);

    // save settings
    try {
        fs.writeFileSync(apiConfigPath, settings);
    } catch (e) {
        // log error
        logger.error(`Error saving API settings: ${e}`);

        // an error occurred
        return false;
    }

    // settings saved
    return true;
};

// determine if we should use services
let runMongoAsAService;
let runGoDataAPIAsAService;
if (
    winCfgPath && (
        (NODE_PLATFORM || process.env.NODE_PLATFORM) === 'win' ||
        (MONGO_PLATFORM || process.env.MONGO_PLATFORM) === 'win'
    )
) {
    const winSettings = retrieveWinSettings();
    const installationTypeUseServices = winSettings.installationTypeUseServices !== '0';
    runMongoAsAService = installationTypeUseServices;
    runGoDataAPIAsAService = installationTypeUseServices;
} else {
    runMongoAsAService = (MONGO_PLATFORM || process.env.MONGO_PLATFORM) === 'win';
    runGoDataAPIAsAService = (NODE_PLATFORM || process.env.NODE_PLATFORM) === 'win';
}

// export
module.exports = {
    getMongoPort,
    setMongoPort,
    getAppPort,
    setAppPort,
    getEncryptionCapability,
    retrieveWinSettings,
    retrieveAPISettings,
    updateAPISettings,
    runMongoAsAService,
    runGoDataAPIAsAService
};
