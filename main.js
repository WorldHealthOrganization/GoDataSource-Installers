// Modules to control application life and create native browser window
const {app, Tray, shell} = require('electron')
const ProgressBar = require('electron-progressbar')
const path = require('path')
const rl = require('readline')
const os = require('os')

const resourceDirectory = path.join(__dirname, 'resources')

const settings = require('./controllers/settings')
const prelaunch = require('./controllers/prelaunch')
const mongo = require('./controllers/mongo')
const goData = require('./controllers/goData')
const logger = require('./logger/app')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let tray = undefined

const createTray = () => {
    tray = new Tray(path.join(resourceDirectory, 'icon.png'))
    tray.on('click', (event) => {
        console.log('tray clicked')
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

    let shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
        goData.api.getPort((err, port) => {
            if (!err) {
                shell.openExternal(`http://localhost:${port}`)
            }
        })
    })

    if (shouldQuit) {
        app.quit()
        return
    }

    var progressBar = new ProgressBar({
        title: 'Launching GoData...'
    })
    createTray()

    progressBar.detail = 'Configuring logging...'
    logger.init()

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
                                logger.logger.info(`Opening GoData at ${appURL}`)
                                shell.openExternal(appURL)
                            }
                            progressBar.close()
                        })
                })
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
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
})

app.on('will-quit', function () {
    console.log('about to ma ia dracu')
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
