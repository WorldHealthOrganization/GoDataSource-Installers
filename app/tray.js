'use strict'

const {app, Menu, Tray, dialog} = require('electron')
const path = require('path')

const AppPaths = require('./../utils/paths')

const webApp = require('./web-app')
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
            click: () => {
                webApp.openWebApp()
            }
        },
        // Option "Settings"
        {
            label: `Settings`,
            click: () => {
                appSettings.openSettings(constants.SETTINGS_WINDOW_SETTING)
            }
        },
        // Options "Reset Password"
        {
            label: `Reset Admin Password`,
            click: () => {
                // Ask user to reset the password
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
        },
        // Option Restore Backup
        {
            label: `Restore Backup`,
            click: () => {
                appSettings.openSettings(constants.SETTINGS_WINDOW_SETTING)
            }
        },
        {type: 'separator'},
        // Option Check Updates
        {
            label: `Check for updates`,
            click: () => {
                updater.setState(constants.UPDATER_STATE_MANUAL)
                updater.checkForUpdates()
            }
        },
        {type: 'separator'},
        // Option Quit
        {
            label: `Quit ${productName}`,
            click: () => {
                cleanup.cleanup()
                appLoading.openPleaseWait()
                setTimeout(app.quit, 4000)
            }
        }
    ])

    // Set the context menu and double click events
    tray.setContextMenu(contextMenu)
    tray.on('double-click', (event, bounds) => {
        appWebApp.openWebApp()
    })
}

module.exports = {
    createTray
}