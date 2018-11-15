// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, Tray, shell, dialog} = require('electron')

const path = require('path')
const rl = require('readline')

const async = require('async')

const appVersion = require('./utils/appVersion')
const AppPaths = require('./utils/paths')
const productName = AppPaths.desktopApp.package.name

const settings = require('./controllers/settings')
const ipcMain = require('./controllers/ipcMain')
const prelaunch = require('./controllers/prelaunch')
const mongo = require('./controllers/mongo')
const goData = require('./controllers/goData')
const goDataAPI = require('./controllers/goDataAPI')
const goDataAdmin = require('./controllers/goDataAdmin')
const encryptionController = require('./controllers/encryption')
const updater = require('./updater/updater')
const logger = require('./logger/app')
const constants = require('./utils/constants')

const appLoading = require('./app/loading')
const appUpdate = require('./app/update')
const appSplash = require('./app/splash')
const appSettings = require('./app/settings')
const appWebApp = require('./app/web-app')
const appTray = require('./app/tray')

const {NODE_PLATFORM} = require('./package')

const platform = process.env.NODE_PLATFORM || NODE_PLATFORM

// Determines if another app instance is running and opens the existing one or launches a new instance
const checkSingletonInstance = () => {
    let shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
        appWebApp.openWebApp()
    })
    if (shouldQuit) {
        logger.logger.info(`Detected previous ${productName} instance, will quit app...`)
        app.quit()
        return true
    }
    return false
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

    appLoading.openPleaseWait()

    // set up logger
    logger.init((err) => {
        if (!err) {
            if (checkSingletonInstance()) {
                return
            }
            appUpdate.configureUpdate(() => {
                appVersion.getVersion((err, version) => {
                    appSettings.configureIPCMain()
                    appSplash.configureIPCMain()

                    if (err && err.code === 'ENOENT') {
                        // fresh install, no app version set => set version and perform population with early exit
                        appSettings.openSettings(constants.SETTINGS_WINDOW_LAUNCH)
                    } else {
                        appWebApp.launchGoData(() => {
                            appTray.createTray()
                        })
                    }
                })
            })
        } else {
            //display error that logger was not initialized
        }
    })

    let readline = rl.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    readline.on('SIGINT', () => {
        process.emit('SIGINT')
    })
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    // if (process.platform !== 'darwin') {
    //     app.quit()
    // }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
})

app.on('will-quit', function () {
    logger.logger.info('App will now quit!')
})

//do something when app is closing
process.on('exit', () => {
    // cleanup('EXIT')
})

//catches ctrl+c event
process.on('SIGINT', () => {
    // cleanup('SIGINT')
})

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', () => {
    // cleanup('SIGUSR1')
})
process.on('SIGUSR2', () => {
    // cleanup('SIGUSR2')
})

//catches uncaught exceptions
// process.on('uncaughtException', (exc) => {
//     appSplash.sendSplashEvent('event', exc.message)
//     appSplash.sendSplashEvent('error', null)
// })
