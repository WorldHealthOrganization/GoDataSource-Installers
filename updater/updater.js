'use strict'

const electron = require('electron')
const {app, dialog, BrowserWindow} = electron
const {autoUpdater} = require('electron-updater')

const path = require('path')

const logger = require('../logger/app')
const {ARCH} = require('./../package')
const { UPDATER_STATE_AUTO } = require('./../utils/constants')

let state = UPDATER_STATE_AUTO

const setState = (newState) => {
    state = newState
}

// Auto-updater tasks
const configureUpdater = (events, callback) => {
    autoUpdater.logger = logger.logger
    autoUpdater.autoDownload = false
    if (process.env.NODE_ENV === 'development') {
        autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
    } else {
        switch (ARCH) {
            case 'x64':
                autoUpdater.updateConfigPath = path.join(__dirname, 'app-update-x64.yml')
                break
            case 'x86':
                autoUpdater.updateConfigPath = path.join(__dirname, 'app-update-x86.yml')
                break
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
                autoUpdater.downloadUpdate()
                callback(null, true)
            }
            else {
                if (state === UPDATER_STATE_AUTO) {
                    callback(null, false)
                }
            }
        })
    })
    autoUpdater.on('update-not-available', () => {
        logger.logger.info('Current version up to date!')
        if (state === UPDATER_STATE_AUTO) {
            callback(null, false)
        } else {
            dialog.showMessageBox({
                title: 'Go.Data Updater',
                message: 'Current version up to date'
            })
        }
    })
    autoUpdater.on('error', (error) => {
        logger.logger.error(`Updater error: ${error.message}`)
        if (isNetworkError(error) || isUpdaterError(error)) {
            if (state === UPDATER_STATE_AUTO) {
                callback(null, false)
            } else {
                dialog.showMessageBox({
                    title: 'Go.Data Updater',
                    message: error.message
                })
            }
        } else {
            dialog.showMessageBox({
                title: 'Error installing update',
                message: error.message
            }, () => {
                setImmediate(() => app.quit())
            })
        }
    })
    autoUpdater.on('download-progress', (ev, progressObj) => {
        events && events(ev)
    })
    autoUpdater.on('update-downloaded', () => {
        app.removeAllListeners('window-all-closed')
        let browserWindows = BrowserWindow.getAllWindows()
        browserWindows.forEach((browserWindow) => {
            browserWindow.removeAllListeners('close')
        })
        setImmediate(() => autoUpdater.quitAndInstall())
    })
    checkForUpdates()
}

function isNetworkError(errorObject) {
    return errorObject.message === "net::ERR_INTERNET_DISCONNECTED" ||
        errorObject.message === "net::ERR_PROXY_CONNECTION_FAILED" ||
        errorObject.message === "net::ERR_CONNECTION_RESET" ||
        errorObject.message === "net::ERR_CONNECTION_CLOSE" ||
        errorObject.message === "net::ERR_NAME_NOT_RESOLVED" ||
        errorObject.message === "net::ERR_CONNECTION_TIMED_OUT" ||
        errorObject.message === "net::ERR_CONNECTION_REFUSED"
}

function isUpdaterError(errorObject) {
    return errorObject.code === "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND"
}

const checkForUpdates = () => {
    autoUpdater.checkForUpdates()
}

module.exports = {
    configureUpdater,
    checkForUpdates,
    setState
}
