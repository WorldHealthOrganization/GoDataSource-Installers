// Modules to control application life and create native browser window
const {app, Tray} = require('electron')
const path = require('path')

const resourceDirectory = path.join(__dirname, 'resources')

const db = require('./controllers/mongo')
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
    createTray()
    logger.init()
    db.init((event) => {})
    goData.init()
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
