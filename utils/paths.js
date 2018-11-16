const {app} = require('electron')
const path = require('path')

const desktopAppPackage = require('./../package')
const {NODE_PLATFORM, MONGO_PLATFORM, ARCH, OSVERSION} = require('./../package')

const appDirectory = app.getPath('userData')
const dbDirectory = path.join(app.getPath('userData'), 'db')
const dbLogDirectory = path.join(app.getPath('userData'), 'logs/db')
const dbLogPath = path.join(dbLogDirectory, 'db.log')

const appLogDirectory = path.join(app.getPath('userData'), 'logs/app')
const appLogPath = path.join(appLogDirectory, 'web-app.log')

const testEnctryptionDirectory = path.join(app.getPath('userData'), 'logs/TEST')

const resourceDirectory = path.join(__dirname, './../resources')
const windowsDirectory = path.join(__dirname, './../windows')

let webAppDirectory = undefined
let mongodPath = undefined
let mongoPath = undefined
let nodePath = undefined
let pm2Module = undefined
let dbScript = undefined
let backupScript = undefined
let configScript = undefined
if (process.env.NODE_ENV === 'development') {
    webAppDirectory = path.join(__dirname, './../go-data/build')
    mongodPath = path.join(__dirname, `./../platforms/${process.env.MONGO_PLATFORM}/${process.env.ARCH}/${process.env.OSVERSION}/mongodb/bin/mongod${ process.env.MONGO_PLATFORM === 'win' ? '.exe' : '' }`)
    mongoPath = path.join(__dirname, `./../platforms/${process.env.MONGO_PLATFORM}/${process.env.ARCH}/${process.env.OSVERSION}/mongodb/bin/mongo${ process.env.MONGO_PLATFORM === 'win' ? '.exe' : '' }`)
    nodePath = path.join(__dirname, `./../platforms/${process.env.NODE_PLATFORM}/${process.env.ARCH}/default/node${process.env.NODE_PLATFORM !== 'win' ? '/bin' : ''}/node`)
    pm2Module = process.platform === 'win32' ? path.join(__dirname, './../app-management/node_modules/pm2') : path.join(__dirname, './../app-management/lib/node_modules/pm2')
    dbScript = path.join(__dirname, './../go-data/build/server/install/install.js')
    backupScript = path.join(__dirname, './../go-data/build/server/scripts/restoreBackup.js')
    configScript = path.join(__dirname, './../go-data/build/installer/common/config.js')
} else {
    webAppDirectory = path.join(process.resourcesPath, 'go-data/build')
    mongodPath = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin/mongod${ MONGO_PLATFORM === 'win' ? '.exe' : '' }`)
    mongoPath = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin/mongo${ MONGO_PLATFORM === 'win' ? '.exe' : '' }`)
    nodePath = path.join(process.resourcesPath, `./platforms/${NODE_PLATFORM}/${ARCH}/default/node${NODE_PLATFORM !== 'win' ? '/bin' : ''}/node`)
    pm2Module = process.platform === 'win32' ?  path.join(process.resourcesPath, './app-management/node_modules/pm2') : path.join(process.resourcesPath, './app-management/lib/node_modules/pm2')
    dbScript = path.join(process.resourcesPath, './go-data/build/server/install/install.js')
    backupScript = path.join(process.resourcesPath, './go-data/build/server/scripts/restoreBackup.js')
    configScript = path.join(process.resourcesPath, './go-data/build/installer/common/config.js')
}

const pm2File = path.join(pm2Module, 'bin/pm2')
const webAppPackage = path.join(webAppDirectory, 'package')
const webAppVersion = require(webAppPackage).version
const webAppInstalledVersion = path.join(app.getPath('userData'), '.appVersion')
const settingsFile = path.join(app.getPath('userData'), '.settings')

module.exports = {
    appDirectory: appDirectory,
    webApp: {
        directory: webAppDirectory,                 // Location of the Go.Data web app directory
        package: webAppPackage,                     // Location of package.json for Go.Data web app
        currentVersion: webAppVersion,              // Version of Go.Data web app taken from package.json
        installedVersion: webAppInstalledVersion,   // Location of file that contains the version of the installed Go.Data web
        configScript: configScript                  // Location of the script to call Go.Data configuration API
    },
    desktopApp: {
        package: desktopAppPackage,                 // Location of package.json for Go.Data desktop app
        settingsFile: settingsFile                  // Location of the settings file for Go.Data desktop app
    },
    databaseDirectory: dbDirectory,                 // Location of the Go.Data database
    databaseLogDirectory: dbLogDirectory,           // Location of the Go.Data database logs directory
    databaseLogFile: dbLogPath,                     // Location of the Go.Data database log
    databaseScriptFile: dbScript,                   // Location of the script to populate/migrate the Go.Data database
    restoreBackupScriptFile: backupScript,          // Location of the script to restore backup
    appLogDirectory: appLogDirectory,               // Location of the Go.Data logs directory
    appLogFile: appLogPath,                         // Location of the Go.Data log
    nodeFile: nodePath,                             // Location of the node executable used for Go.Data web app
    mongodFile: mongodPath,                         // Location of the Mongod executable
    mongoFile: mongoPath,
    pm2Module: pm2Module,                           // Location of the PM2 module (to be used programatically)
    pm2File: pm2File,                               // Location of the PM2 executable (to be used with child process)
    resourcesDirectory: resourceDirectory,
    windowsDirectory: windowsDirectory,
    testEncryptionDirectory: testEnctryptionDirectory
}
