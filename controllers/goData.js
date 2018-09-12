'use strict'

/**
 * Starts Go.Data API & Web app
 */


const {spawn, spawnSync} = require('child_process')
const { NODE_PLATFORM, ARCH, VERSION: OSVERSION } = require('./../package');

const init = () => {
    startGoData()
}

/**
 * Starts the Mongo database from depending on system configuration
 */
function startGoData() {
    let mongodPath = path.join(process.resourcesPath, `./platforms/${MONGO_PLATFORM}/${ARCH}/${OSVERSION}/mongodb/bin/mongod`)
    // Make sure NODE_ENV is set, electron doesn't accept environmental variables
    if (process.env.NODE_ENV === 'development') {
        mongodPath = path.join(__dirname, `./../platforms/${MONGO_PLATFORM}/${ARCH}/${VERSION}/mongodb/bin/mongod`)
    }

    logger.info(`Starting Mongo database from path ${mongodPath} ...`)
    const child = spawn(mongodPath, [`--dbpath=${dbDirectory}`, `--logpath=${logPath}`])

    child.stdout.on('close', (code) => {
        logger.info(`Mongo process exited with code ${code}`)
        if (code) {
            throw new Error(`Mongo process exited with code ${code}`)
        }
    })
}

module.exports = {
    init
}
