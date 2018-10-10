// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, Tray, shell} = require('electron')
const ProgressBar = require('electron-progressbar')
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
const logger = require('./logger/app')
const constants = require('./utils/constants')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray = null
let settingsWindow = null
let progressBar = null

const createTray = () => {
    tray = new Tray(path.join(AppPaths.resourcesDirectory, 'icon.png'))
    const contextMenu = Menu.buildFromTemplate([
        {
            label: `Open ${productName}`, click: () => {
                openWebApp()
            }
        },
        {
            label: `Settings`, click: () => {
                openSettings(constants.SETTINGS_WINDOW_SETTING)
            }
        },
        {type: 'separator'},
        {label: `Quit ${productName}`, role: 'quit'}
    ])
    tray.setContextMenu(contextMenu)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

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
            appVersion.getVersion((err, version) => {
                ipcMain.init((mongoPort, goDataPort, state) => {
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

    let readline = rl.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    readline.on('SIGINT', () => {
        process.emit('SIGINT')
    })

})

function launchGoData() {
    progressBar = new ProgressBar({
        title: `Launching ${productName}...`
    })

    progressBar._window.webContents.openDevTools()

    progressBar.detail = 'Cleaning up...'
    prelaunch.cleanUp(
        (event) => {

        },
        () => {
            progressBar.detail = 'Creating database...'
            mongo.init(
                (event) => {
                    if (progressBar.isInProgress()) {
                        if (event.detail) {
                            progressBar.detail = event.detail
                        }
                        if (event.text) {
                            progressBar.text = event.text
                        }
                    }
                },
                () => {
                    goData.init(
                        (event) => {
                            if (progressBar.isInProgress()) {
                                if (event.detail) {
                                    progressBar.detail = event.detail
                                }
                                if (event.text) {
                                    progressBar.text = event.text
                                }
                            }
                        },
                        (err, appURL) => {
                            if (appURL) {
                                logger.logger.info(`Opening ${productName} at ${appURL}`)
                                openWebApp(appURL)
                            }
                            progressBar.close()
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
        width: 900,
        height: 400,
        // resizable: false,
        center: true,
        frame: false,
        show: false
    })
    settingsWindow.loadFile(path.join(AppPaths.windowsDirectory, 'settings.html'))
    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show()
        settingsWindow.webContents.openDevTools()
    })
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

const cleanup = (code) => {
    logger.logger.log(`Exiting program with code ${code}.`)
    mongo.killMongo()
    goData.killGoData()
    process.exit()
}

//do something when app is closing
process.on('exit', () => {
    cleanup('EXIT')
})

//catches ctrl+c event
process.on('SIGINT', () => {
    cleanup('SIGINT')
})

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', () => {
    cleanup('SIGUSR1')
})
process.on('SIGUSR2', () => {
    cleanup('SIGUSR2')
})

//catches uncaught exceptions
// process.on('uncaughtException', (exc) => {
// console.log(exc)
// cleanup('uncaughtException')
// });
