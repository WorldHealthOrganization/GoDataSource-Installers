'use strict'

const { ipcMain } = require('electron')

const settings = require('./settings')

const logger = require('./../logger/app').logger

let state;

const init = (events) => {

    logger.info('Initializing IPCMain...')

    ipcMain.on('getState-message', (event, arg) => {
        logger.log('IPCMain received getState-message')
        event.sender.send('getState-reply', state)
    })

    ipcMain.on('getDbPort-message', (event, arg) => {
        logger.log('IPCMain received getDbPort-message')
        settings.getMongoPort((err, port) => {
            event.sender.send('getDBPort-reply', err ? err.message : port)
        })
    })

    ipcMain.on('getGoDataPort-message', (event, arg) => {
        logger.log('IPCMain received getGoDataPort-message')
        settings.getAppPort((err, port) => {
            event.sender.send('getGoDataPort-reply', err ? err.message : port)
        })
    })

    ipcMain.on('buttonClick-message', (event, ports) => {
        logger.log('IPCMain received buttonClick-message')
        events(ports.mongoPort, ports.goDataPort, state)
    })

    logger.info('Initialized IPCMain')
}

function setState(newState) {
    state = newState
}

module.exports = {
    init,
    setState
}
