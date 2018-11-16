'use strict'

const { shell } = require('electron')

const goData = require('./../controllers/goData')
const goDataAPI = require('./../controllers/goDataAPI')

const appSplash = require('./splash')

const prelaunch = require('./../controllers/prelaunch')
const mongo = require('./../controllers/mongo')

const AppPaths = require('./../utils/paths')
const productName = AppPaths.desktopApp.package.name

const logger = require('./../logger/app')

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
        shell.openExternal(appURL)
    } else {
        goDataAPI.getAppPort((err, port) => {
            if (!err) {
                shell.openExternal(`http://localhost:${port}`)
            }
        })
    }
}

module.exports = {
    launchGoData,
    setGoDataConfiguration,
    openWebApp
}
