// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, Tray, shell} = require('electron')

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
const updater = require('./updater/updater')
const logger = require('./logger/app')
const constants = require('./utils/constants')
const formatter = require('./utils/formatter')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray = null
let settingsWindow = null
let splashScreen = null
let pleaseWaitScreen = null

// used at first launch to start web app as hub or consolidation server
let goDataConfiguration = null

const createTray = () => {
    tray = new Tray(path.join(AppPaths.resourcesDirectory, 'icon.png'))
    const contextMenu = Menu.buildFromTemplate([
        {
            label: `Open ${productName}`,
            click: () => {
                openWebApp()
            }
        },
        {
            label: `Settings`,
            click: () => {
                openSettings(constants.SETTINGS_WINDOW_SETTING)
            }
        },
        {
            label: `Check for updates`,
            click: () => {
                updater.setState(constants.UPDATER_STATE_MANUAL)
                updater.checkForUpdates()
            }
        },
        {type: 'separator'},
        {
            label: `Quit ${productName}`,
            click: () => {
                cleanup(0)
                setTimeout(app.quit, 4000)
            }
        }
    ])
    tray.setContextMenu(contextMenu)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

    openPleaseWait()

    let shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
        openWebApp()
    })

    if (shouldQuit) {
        logger.logger.info(`Detected previous ${productName} instance, will quit app...`)
        app.quit()
        return
    }

    // set up logger
    logger.init((err) => {
        if (!err) {
            let updateScreen
            updater.configureUpdater(
                (event) => {
                    let percentage = Math.round(event.percent * 10) / 10
                    if (percentage === 100) {
                        updateScreen.webContents.send('event', `Please wait while ${productName} relaunches. This may take a few minutes.`)
                    } else {
                        updateScreen.webContents.send('event', `Downloading update ${Math.round(event.percent * 10) / 10}% - ${formatter.formatBytes(event.transferred)}/${formatter.formatBytes(event.total)}`)
                    }
                },
                (err, updateAvailable) => {
                    if (updateAvailable) {
                        updateScreen = new BrowserWindow({
                            width: 900,
                            height: 475,
                            resizable: false,
                            center: true,
                            frame: false,
                            show: false
                        })
                        updateScreen.loadFile(path.join(AppPaths.windowsDirectory, 'loading', 'index.html'))

                        updateScreen.once('ready-to-show', () => {
                            updateScreen.show()
                        })
                        updateScreen.webContents.send('event', 'Downloading update...')
                    } else {
                        appVersion.getVersion((err, version) => {
                            ipcMain.init((mongoPort, goDataPort, appType, state) => {

                                goDataConfiguration = appType

                                switch (state) {
                                    case constants.SETTINGS_WINDOW_LAUNCH:
                                        setPortsInSettings(true, () => {
                                            launchGoData()
                                            settingsWindow.close()
                                        })
                                        break
                                    case constants.SETTINGS_WINDOW_SETTING:
                                        setPortsInSettings(false, () => {
                                            settingsWindow.close()
                                        })
                                        break
                                }

                                function setPortsInSettings(immediately, callback) {
                                    async.series([
                                            (callback) => {
                                                settings.setMongoPort(mongoPort, callback)
                                            },
                                            (callback) => {
                                                settings.setAppPort(goDataPort, callback)
                                            }
                                        ],
                                        callback)
                                }
                            })

                            if (err && err.code === 'ENOENT') {
                                // fresh install, no app version set => set version and perform population with early exit
                                openSettings(constants.SETTINGS_WINDOW_LAUNCH)
                            } else {
                                launchGoData()
                            }
                        })
                    }
                })
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

function launchGoData() {

    splashScreen = new BrowserWindow({
        width: 900,
        height: 475,
        resizable: false,
        center: true,
        frame: false,
        show: false
    })
    splashScreen.loadFile(path.join(AppPaths.windowsDirectory, 'loading', 'index.html'))

    splashScreen.on('closed', () => {
        splashScreen = null
    })
    splashScreen.once('ready-to-show', () => {
        closePleaseWait()
        splashScreen.show()
    })

    splashScreen.webContents.send('event', 'Cleaning up...')

    prelaunch.setBuildConfiguration(goDataConfiguration)
    prelaunch.cleanUp(
        (event) => {

        },
        () => {
            let loadingIndicator = ['⦾', '⦿']
            let index = 0
            mongo.init(
                (event) => {
                    if (event.text) {
                        splashScreen && splashScreen.webContents.send('event', `${loadingIndicator[(++index) % 2]} ${event.text}`)

                    }
                },
                () => {
                    goData.init(
                        (event) => {
                            if (event.text) {
                                splashScreen && splashScreen.webContents.send('event', `${loadingIndicator[(++index) % 2]} ${event.text}`)
                            }
                        },
                        (err, appURL) => {
                            if (appURL) {
                                logger.logger.info(`Opening ${productName} at ${appURL}`)
                                openWebApp(appURL)
                            }
                            splashScreen.close()
                            createTray()
                        })
                })
        })
}

function openWebApp(appURL) {
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

function openSettings(settingType) {
    ipcMain.setState(settingType)
    if (settingsWindow) {
        settingsWindow.show()
        return
    }
    settingsWindow = new BrowserWindow({
        width: 300,
        height: settingType === constants.SETTINGS_WINDOW_SETTING ? 370 : 420,
        resizable: false,
        center: true,
        frame: false,
        show: false
    })
    settingsWindow.loadFile(path.join(AppPaths.windowsDirectory, 'settings', 'settings.html'))
    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
    settingsWindow.once('ready-to-show', () => {
        closePleaseWait()
        settingsWindow.show()
    })
}

function openPleaseWait() {
    pleaseWaitScreen = new BrowserWindow({
        width: 250,
        height: 120,
        resizable: false,
        center: true,
        frame: false,
        show: false
    })
    pleaseWaitScreen.loadFile(path.join(AppPaths.windowsDirectory, 'please-wait', 'index.html'))

    pleaseWaitScreen.once('ready-to-show', () => {
        pleaseWaitScreen.show()
    })
}

function closePleaseWait() {
    pleaseWaitScreen && pleaseWaitScreen.close()
    pleaseWaitScreen = null
}

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

const cleanup = () => {
    mongo.setShouldThrowExceptionOnMongoFailure(false)
    mongo.killMongo()
    goData.killGoData()
}

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
process.on('uncaughtException', (exc) => {
    logger.logger.error(exc)
    setTimeout(process.exit, 3000)
// cleanup('uncaughtException')
})
