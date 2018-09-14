'use strict'

/**
 * Starts Go.Data API & Web app
 */

const path = require('path')
const {NODE_PLATFORM, ARCH} = require('./../package')


const logger = require('./../logger/app').logger
const logDirectory = require('./../logger/app').logDirectory
const logPath = path.join(logDirectory, 'web-app.log')

let pm2Path = undefined
if (process.env.NODE_ENV === 'development') {
    pm2Path = './../app-management/lib/node_modules/pm2'
} else {
    pm2Path = path.join(process.resourcesPath, 'app-management/lib/node_modules/pm2')
}
const pm2 = require(pm2Path)

const init = () => {
    startGoData()
}

/**
 * Starts the Mongo database from depending on system configuration
 */
function startGoData() {

    let npmPath = undefined
    let nodePath = undefined
    if (process.env.NODE_ENV === 'development') {
        npmPath = path.join(__dirname, `./../platforms/${process.env.NODE_PLATFORM}/${process.env.ARCH}/default/node${process.env.NODE_PLATFORM !== 'win' ? '/bin' : ''}/npm`)
        nodePath = path.join(__dirname, `./../platforms/${process.env.NODE_PLATFORM}/${process.env.ARCH}/default/node${process.env.NODE_PLATFORM !== 'win' ? '/bin' : ''}/node`)
    } else {
        npmPath = path.join(process.resourcesPath, `./platforms/${NODE_PLATFORM}/${ARCH}/default/node${NODE_PLATFORM !== 'win' ? '/bin' : ''}/npm`)
        nodePath = path.join(process.resourcesPath, `./platforms/${NODE_PLATFORM}/${ARCH}/default/node${NODE_PLATFORM !== 'win' ? '/bin' : ''}/node`)
    }

    logger.info(`Configuring Go.Data web app...`)
    pm2.connect(true, (err) => {
        if (err) {
            logger.error(`Error connecting PM2 process: ${err.message}`)
            return
        }
        pm2.start({
                apps: [
                    {
                        name: "GoData",
                        script: nodePath,
                        args: ".",
                        cwd: process.env.NODE_ENV === 'development' ? "go-data/build" : path.join(process.resourcesPath, "go-data/build"),
                        output: logPath,
                        error: logPath
                    }
                ]
            },
            (err) => {
                if (err) {
                    logger.info(`Error configuring the Go.Data web app: ${err.message}`)
                    return
                }
                logger.info(`Successfully started Go.Data web app!`)
            })
    })
}

module.exports = {
    init
}
