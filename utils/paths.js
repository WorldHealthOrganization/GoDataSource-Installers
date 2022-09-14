const {app} = require('electron');
const path = require('path');

const desktopAppPackage = require('./../package');
const {NODE_PLATFORM, MONGO_PLATFORM, ARCH, OSVERSION} = require('./../package');

const appDirectory = app.getPath('userData');
const dbDirectory = path.join(app.getPath('userData'), 'db');
const dbLogDirectory = path.join(app.getPath('userData'), 'logs/db');
const dbLogPath = path.join(dbLogDirectory, 'db.log');

const appLogDirectory = path.join(app.getPath('userData'), 'logs/app');
const appLogPath = path.join(appLogDirectory, 'web-app.log');

const testEnctryptionDirectory = path.join(app.getPath('userData'), 'logs/TEST');

const resourceDirectory = path.join(__dirname, './../resources');
const windowsDirectory = path.join(__dirname, './../windows');

let webAppDirectory = undefined;
let webAppLogDirectory = undefined;
let mongodPath = undefined;
let mongodRestore = undefined;
let mongod3Path = undefined;
let mongod3Dump = undefined;
let nodePath = undefined;
let nssmPath = undefined;
let pm2Module = undefined;
let dbScript = undefined;
let backupScript = undefined;
let configScript = undefined;
let winCfgPath;
let apiConfigPath;
let apiDataSourcePath;
let winOldNewApiCfgPath;
let winOldNewDatasourceCfgPath;
if (process.env.NODE_ENV === 'development') {
    webAppDirectory = path.join(__dirname, './../go-data/build');
    webAppLogDirectory = path.join(webAppDirectory, 'logs');
    mongodPath = path.join(__dirname, `./../platforms/${process.env.MONGO_PLATFORM}/${process.env.ARCH}/${process.env.OSVERSION}/mongodb/bin/mongod${ process.env.MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    mongodRestore = path.join(__dirname, `./../platforms/${process.env.MONGO_PLATFORM}/${process.env.ARCH}/${process.env.OSVERSION}/mongodb/bin/mongorestore${ process.env.MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    mongod3Path = path.join(__dirname, `./../platforms/${process.env.MONGO_PLATFORM}/${process.env.ARCH}/${process.env.OSVERSION}/mongodb/bin3/mongod${ process.env.MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    mongod3Dump = path.join(__dirname, `./../platforms/${process.env.MONGO_PLATFORM}/${process.env.ARCH}/${process.env.OSVERSION}/mongodb/bin3/mongodump${ process.env.MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    nodePath = path.join(__dirname, `./../platforms/${process.env.NODE_PLATFORM}/${process.env.ARCH}/default/node${process.env.NODE_PLATFORM !== 'win' ? '/bin' : ''}/node`);
    nssmPath = path.join(__dirname, `./../platforms/${process.env.NODE_PLATFORM}/${process.env.ARCH}/default/nssm/nssm.exe`);
    pm2Module = process.platform === 'win32' ? path.join(__dirname, './../app-management/node_modules/pm2') : path.join(__dirname, './../app-management/lib/node_modules/pm2');
    dbScript = path.join(__dirname, './../go-data/build/server/install/install.js');
    backupScript = path.join(__dirname, './../go-data/build/server/scripts/restoreBackup.js');
    configScript = path.join(__dirname, './../go-data/build/installer/common/config.js');
    winCfgPath = path.join(__dirname, './../winCfg.cfg');
    apiConfigPath = path.join(__dirname, './../go-data/build/server/config.json');
    apiDataSourcePath = path.join(__dirname, './../go-data/build/server/datasources.json');
    winOldNewApiCfgPath = path.join(__dirname, './../config.json.backup_new');
    winOldNewDatasourceCfgPath = path.join(__dirname, './../datasources.json.backup_new');
} else {
    webAppDirectory = path.join(process.resourcesPath, 'go-data/build');
    webAppLogDirectory = path.join(webAppDirectory, 'logs');
    mongodPath = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin/mongod${ MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    mongodRestore = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin/mongorestore${ MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    mongod3Path = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin3/mongod${ MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    mongod3Dump = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin3/mongodump${ MONGO_PLATFORM === 'win' ? '.exe' : '' }`);
    nodePath = path.join(process.resourcesPath, `./platforms/${NODE_PLATFORM}/${ARCH}/default/node${NODE_PLATFORM !== 'win' ? '/bin' : ''}/node`);
    nssmPath = path.join(process.resourcesPath, `./platforms/${NODE_PLATFORM}/${ARCH}/default/nssm/nssm.exe`);
    pm2Module = process.platform === 'win32' ?  path.join(process.resourcesPath, './app-management/node_modules/pm2') : path.join(process.resourcesPath, './app-management/lib/node_modules/pm2');
    dbScript = path.join(process.resourcesPath, './go-data/build/server/install/install.js');
    backupScript = path.join(process.resourcesPath, './go-data/build/server/scripts/restoreBackup.js');
    configScript = path.join(process.resourcesPath, './go-data/build/installer/common/config.js');
    winCfgPath = path.join(process.resourcesPath, './../winCfg.cfg');
    apiConfigPath = path.join(process.resourcesPath, './go-data/build/server/config.json');
    apiDataSourcePath = path.join(process.resourcesPath, './go-data/build/server/datasources.json');
    winOldNewApiCfgPath = path.join(process.resourcesPath, './../../config.json.backup_new');
    winOldNewDatasourceCfgPath = path.join(process.resourcesPath, './../../datasources.json.backup_new');
}

const webAppLaunchScript = path.join(webAppDirectory, 'server/server.js');
const webAppPackage = path.join(webAppDirectory, 'package');
const webAppVersion = require(webAppPackage).version;
const webAppInstalledVersion = path.join(app.getPath('userData'), '.appVersion');
const settingsFile = path.join(app.getPath('userData'), '.settings');

module.exports = {
    appDirectory: appDirectory,
    webApp: {
        directory: webAppDirectory,                 // Location of the Go.Data web app directory
        logDirectory: webAppLogDirectory,           // Location of the Go.Data web app logs directory
        launchScript: webAppLaunchScript,           // Location of the Go.Data main file (server/server.js)
        package: webAppPackage,                     // Location of package.json for Go.Data web app
        currentVersion: webAppVersion,              // Version of Go.Data web app taken from package.json
        installedVersion: webAppInstalledVersion,   // Location of file that contains the version of the installed Go.Data web
        configScript: configScript,                 // Location of the script to call Go.Data configuration API
        winOldNewApiCfgPath: winOldNewApiCfgPath,   // Location of the new installation API config file
        winOldNewDatasourceCfgPath: winOldNewDatasourceCfgPath // Location of the new installation API datasource file
    },
    desktopApp: {
        package: desktopAppPackage,                 // Location of package.json for Go.Data desktop app
        settingsFile: settingsFile,                 // Location of the settings file for Go.Data desktop app
        winCfgPath: winCfgPath                      // Config specific to windows instances
    },
    databaseDirectory: dbDirectory,                 // Location of the Go.Data database
    databaseLogDirectory: dbLogDirectory,           // Location of the Go.Data database logs directory
    databaseLogFile: dbLogPath,                     // Location of the Go.Data database log
    databaseScriptFile: dbScript,                   // Location of the script to populate/migrate the Go.Data database
    restoreBackupScriptFile: backupScript,          // Location of the script to restore backup
    appLogDirectory: appLogDirectory,               // Location of the Go.Data logs directory
    appLogFile: appLogPath,                         // Location of the Go.Data log
    nodeFile: nodePath,                             // Location of the node executable used for Go.Data web app
    nssmFile: nssmPath,                             // Location of the nssm executable used on Windows to create a service from an executable
    mongodFile: mongodPath,                         // Location of the Mongod 5.x executable
    mongodRestore: mongodRestore,                   // Location of the Mongod 5.x restore database
    mongod3File: mongod3Path,                       // Location of the Mongod 3.x executable
    mongod3Dump: mongod3Dump,                       // Location of the Mongod 3.x dump database
    pm2Module: pm2Module,                           // Location of the PM2 module (to be used programatically)
    resourcesDirectory: resourceDirectory,
    windowsDirectory: windowsDirectory,
    testEncryptionDirectory: testEnctryptionDirectory,
    apiConfigPath: apiConfigPath,                   // Path to api config.json file
    apiDataSourcePath: apiDataSourcePath            // Path to api datasource.json file
};
