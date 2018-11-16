'use strict'

const {app, Menu, Tray, dialog} = require('electron')
const path = require('path')

const AppPaths = require('./../utils/paths')

const appLoading = require('./loading')
const appSettings = require('./settings')
const appWebApp = require('./web-app')

const constants = require('./../utils/constants')

const updater = require('./../updater/updater')
const goDataAdmin = require('./../controllers/goDataAdmin')
const cleanup = require('./../controllers/clean-up')

const productName = AppPaths.desktopApp.package.name

let tray = null

/**
 * Creates the system tray with the options.
 */
const createTray = () => {
    // Create the system tray
    tray = new Tray(path.join(AppPaths.resourcesDirectory, 'icon.png'))

    // Create the tray options menu
    const contextMenu = Menu.buildFromTemplate([
        // Option "Open GoData"
        {
            label: `Open ${productName}`,
            click: openWebApp
        },
        // Options "Reset Password"
        {
            label: `Reset Admin Password`,
            click: resetAdminPassword
        },
        // Option Restore Backup
        {
            label: `Restore Backup`,
            click: restoreBackup
        },
        {type: 'separator'},
        // Option "Settings"
        {
            label: `Settings`,
            click: openSettings
        },
        {type: 'separator'},
        // Option Check Updates
        {
            label: `Check for updates`,
            click: checkUpdates
        },
        {type: 'separator'},
        // Option Quit
        {
            label: `Quit ${productName}`,
            click: quit
        }
    ])

    // Set the context menu and double click events
    tray.setContextMenu(contextMenu)
    tray.on('double-click', (event, bounds) => {
        appWebApp.openWebApp()
    })
}

/**
 * Opens Go.Data web app in the default browser
 */
const openWebApp = () => {
    appWebApp.openWebApp()
}

/**
 * Starts the process to reset the Admin password
 */
const resetAdminPassword = () => {
    // Ask user to confirm password reset
    dialog.showMessageBox({
        type: 'warning',
        title: `${productName} Reset Password`,
        message: 'Are you sure you want to reset the current admin password to default?',
        buttons: ['Yes', 'No']
    }, (buttonIndex) => {
        if (buttonIndex === 0) {
            appLoading.openPleaseWait()
            // Call Go Data Admin controller to reset Admin password
            goDataAdmin.resetAdminPassword((code) => {
                appLoading.closePleaseWait()
                dialog.showMessageBox({
                    type: code ? 'error' : 'info',
                    title: `${productName} Reset Password`,
                    message: code ? 'An error occurred while reseting the admin password' : 'Admin password was successfully reset.'
                })
            })
        }
    })
}

/**
 * Starts the process to restore back-up from file
 */
const restoreBackup = () => {
    // show file selection dialog
    dialog.showOpenDialog({
        title: 'Select file to restore back-up',
        properties: ['openFile'],
        message: 'Select file to restore back-up'
    }, (paths) => {
        if (paths && paths[0]) {
            // Ask user to confirm backup restore
            dialog.showMessageBox({
                type: 'warning',
                title: `${productName} Restore Back-up`,
                message: `${productName} will be unavailable while restoring back-up. Are you sure you want to proceed?`,
                buttons: ['Yes', 'No']
            }, (buttonIndex) => {

                // proceed with backup restore
                if (buttonIndex === 0) {

                    appLoading.openPleaseWait()

                    // Call Go Data Admin controller to reset Admin password
                    goDataAdmin.restoreBackup(paths[0], (errors) => {

                        // set default results to success
                        let type = 'info'
                        let message = 'Back-up was successfully restored.'

                        if (errors.length > 0) {
                            type = 'error'
                            message = ''
                            errors.forEach((e) => {
                                switch (e.type) {
                                    case constants.GO_DATA_KILL_ERROR:
                                        message += `An error occurred while closing ${productName} app. Please try again. `
                                        break
                                    case constants.GO_DATA_BACKUP_ERROR:
                                        message += 'An error occurred while restoring back-up. '
                                        break
                                    case constants.GO_DATA_LAUNCH_ERROR:
                                        message += `An error occurred while starting ${productName}. `
                                        break
                                }
                            })
                        }

                        appLoading.closePleaseWait()

                        // Show result dialog
                        dialog.showMessageBox({
                            type: type,
                            title: `${productName} Restore Back-up`,
                            message: message
                        })
                    })
                }
            })
        } else {
            // cancelled file selection, do nothing
        }
    })
}

/**
 * Opens the settings panel
 */
const openSettings = () => {
    appSettings.openSettings(constants.SETTINGS_WINDOW_SETTING)
}

/**
 * Starts process to check for updates
 */
const checkUpdates = () => {
    updater.setState(constants.UPDATER_STATE_MANUAL)
    updater.checkForUpdates()
}

/**
 * Quits Go.Data
 */
const quit = () => {
    cleanup.cleanup()
    appLoading.openPleaseWait()
    setTimeout(app.quit, 4000)
}

module.exports = {
    createTray
}
