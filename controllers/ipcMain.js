'use strict';

const { ipcMain } = require('electron');

const settings = require('./settings');
const encryption = require('./encryption');

const logger = require('./../logger/app').logger;
const goDataAPI = require('./goDataAPI');

const { name, version, NODE_PLATFORM } = require('./../package');

const { APP_EXIT, OPEN_LOGS } = require('./../utils/constants');

let state;

const initSettingsEvents = (events) => {

    logger.info('Initializing IPCMain...');

    ipcMain.on('getState-message', (event) => {
        logger.log('IPCMain received getState-message');
        event.sender.send('getState-reply', state);
    });

    ipcMain.on('getDbPort-message', (event) => {
        logger.log('IPCMain received getDbPort-message');
        settings.getMongoPort((err, port) => {
            event.sender.send('getDBPort-reply', err ? err.message : port);
        });
    });

    ipcMain.on('getGoDataPort-message', (event) => {
        logger.log('IPCMain received getGoDataPort-message');
        settings.getAppPort((err, port) => {
            event.sender.send('getGoDataPort-reply', err ? err.message : port);
        });
    });

    ipcMain.on('getProductVersion-message', (event) => {
        logger.log('IPCMain received getProductVersion-message');
        let platform = process.env.NODE_PLATFORM || NODE_PLATFORM;
        event.sender.send('getProductVersion-reply', `${name} ${version}`, platform);
    });

    ipcMain.on('getBuildNumber-message', (event) => {
        logger.log('IPCMain received getBuildNumber-message');
        goDataAPI.getBuildNumber((err, buildNumber) => {
            event.sender.send('getBuildNumber-reply', buildNumber || 'not set');
        });
    });

    ipcMain.on('getPublicInfo-message', (event) => {
        logger.log('IPCMain received getPublicInfo-message');
        const apiSettings = settings.retrieveAPISettings() || {};
        event.sender.send('getPublicInfo-reply', {
            enableConfigRewrite: apiSettings.enableConfigRewrite,
            public: apiSettings.public
        });
    });

    ipcMain.on('getEncryptionCapabilities-message', (event) => {
        logger.log('IPCMain received getEncryptionCapabilities-message');
        settings.getEncryptionCapability((err, encryptionCapability) => {
            if (!encryptionCapability) {
                // send to window result that encryption is not available
                return event.sender.send('getEncryptionCapabilities-reply', err, false, false);
            }
            //retrieve encryption status
            encryption.getDatabaseEncryptionStatus((err, status) => {
                event.sender.send('getEncryptionCapabilities-reply', err, true, status);
            });
        });
    });

    ipcMain.on('toggleEncryption-message', (event, arg) => {
        logger.log('IPCMain received toggleEncryption-message');
        if (arg) {
            encryption.encryptDatabase(() => {});
        } else {
            encryption.decryptDatabase(() => {});
        }
    });

    ipcMain.on('buttonClick-message', (event, arg) => {
        logger.log('IPCMain received buttonClick-message');
        events(
            arg.mongoPort,
            arg.goDataPort,
            arg.encryption,
            state,
            arg.apiSettings
        );
    });

    logger.info('Initialized IPCMain');
};

const initSplashEvents = (events) => {
    ipcMain.on('open-logs-message', () => {
        logger.log('IPCMain received open-logs-message');
        events(OPEN_LOGS);
    });

    ipcMain.on('exit-message', () => {
        logger.log('IPCMain received exit-message');
        events(APP_EXIT);
    });
};

function setState(newState) {
    state = newState;
}

module.exports = {
    initSettingsEvents,
    initSplashEvents,
    setState
};
