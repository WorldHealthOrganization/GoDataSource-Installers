'use strict'

const { app, BrowserWindow } = require('electron')
const path = require('path')

const goData = require('./../controllers/goData')
const goDataAPI = require('./../controllers/goDataAPI')

const appSplash = require('./splash')

const prelaunch = require('./../controllers/prelaunch')
const mongo = require('./../controllers/mongo')

const AppPaths = require('./../utils/paths')
const productName = AppPaths.desktopApp.package.name

const logger = require('./../logger/app')

const menu = require('./menu')

const contextMenu = require('electron-context-menu')
contextMenu({
    showSaveImageAs: true
})

// used to cache the app URL after app is loaded
let webAppURL = null

// used at first launch to start web app as hub or consolidation server
let goDataConfiguration = null
/**
 * Getter for goDataConfiguration
 * @returns The goDataConfiguration
 */
const setGoDataConfiguration = (configuration) => {
    goDataConfiguration = configuration
}

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

    appSplash.openSplashScreen()
    appSplash.sendSplashEvent('event', 'Cleaning up...')

    prelaunch.setBuildConfiguration(goDataConfiguration)
    prelaunch.cleanUp(
        (event) => { },
        () => {
            let loadingIndicator = ['⦾', '⦿']
            let index = 0
            mongo.init(
                (event) => {
                    if (event.wait) {
                        appSplash.sendSplashEvent('event', 'wait')
                    }
                    if (event.text) {
                        appSplash.sendSplashEvent('event', `${loadingIndicator[(++index) % 2]} ${event.text}`)
                    }
                },
                () => {
                    goData.init(
                        (event) => {
                            if (event.text) {
                                appSplash.sendSplashEvent('event', `${loadingIndicator[(++index) % 2]} ${event.text}`)
                            }
                        },
                        (err, appURL) => {
                            if (err) {
                                appSplash.sendSplashEvent('error', err.message)
                                return callback(err)
                            }
                            if (appURL) {
                                logger.logger.info(`Opening ${productName} at ${appURL}`)
                                openWebApp(appURL)
                            }
                            appSplash.closeSplashScreen()
                            const tray = require('./tray')
                            tray.createTray()
                            callback()
                        })
                })
        })
}


/**
 * Opens the appURL in the default browser. If no appURL is provided, it opens localhost on the port that runs the web app.
 * @param appURL - the URL that will open in the web browser
 */
const openWebApp = (appURL) => {
    if (appURL) {
        webAppURL = appURL;
        openEmbeddedWindow(appURL)
    } else if (webAppURL) {
        openEmbeddedWindow(webAppURL)
    } else {
        goDataAPI.getAppPort((err, port) => {
            if (!err) {
                openEmbeddedWindow(`http://localhost:${port}`)
            }
        })
    }
}

let embeddedAppWindow;
/**
 * Open Go.Data in an Electron window that loads Go.Data Web portal
 * @param url - The URL where Go.Data is running.
 */
const openEmbeddedWindow = (url) => {
    if (!embeddedAppWindow) {
        embeddedAppWindow = new BrowserWindow({
            webPreferences: {
                nodeIntegration: false
            },
            show: false,
            icon: path.join(__dirname, './../build/icon.png')
        });

        // maximize window
        embeddedAppWindow.maximize()
        // then show it
        embeddedAppWindow.show()

        // and load the app.
        embeddedAppWindow.loadURL(url)

        // keep name and URL on app title
        embeddedAppWindow.on('page-title-updated', function (event, title) {
            event.preventDefault();
            embeddedAppWindow.setTitle(title)
        });

        // Emitted when the window is closed.
        embeddedAppWindow.on('closed', function () {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            embeddedAppWindow = null
        });

        app.setApplicationMenu(menu.getMenu(url))

    } else {
        // maximize window
        embeddedAppWindow.maximize()
        // then show it
        embeddedAppWindow.show()
    }
}

module.exports = {
    launchGoData,
    setGoDataConfiguration,
    openWebApp
}
