// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { ipcRenderer } = require('electron')
const constants = require('./../../utils/constants')

let goDataType = 'hub';

// const logger = require('./../logger/app').logger

ipcRenderer.send('getState-message', '')
ipcRenderer.send('getDbPort-message', '')
ipcRenderer.send('getGoDataPort-message', '')

ipcRenderer.on('getState-reply', (event, arg) => {
    // logger.log('IPCRenderer received getState-reply')
    loadView(arg)
    setButtonFunctionality()
    bindToggle()
})

ipcRenderer.on('getDBPort-reply', (event, arg) => {
    // logger.log('IPCRenderer received getDBPort-reply')
    document.getElementById('mongoPort').value = arg
})

ipcRenderer.on('getGoDataPort-reply', (event, arg) => {
    // logger.log('IPCRenderer received getGoDataPort-reply')
    document.getElementById('goDataPort').value = arg
})

function setButtonFunctionality() {
    // logger.log(`Loading settings view button`)
    document.getElementById('settingsButton').onclick = () => {
        ipcRenderer.send(
            'buttonClick-message', {
                mongoPort: document.getElementById('mongoPort').value,
                goDataPort: document.getElementById('goDataPort').value,
                appType: goDataType
            }
        )
    }
}

function bindToggle() {
    let goDataHub = document.getElementById('goDataHub')
    goDataHub.onclick = () => { changeGoDataType(goDataHub) }
    let goDataConsolidation = document.getElementById('goDataConsolidation')
    goDataConsolidation.onclick = () => { changeGoDataType(goDataConsolidation) }
}

function loadView(state) {
    // logger.log(`Loading settings view in ${state} state`)
    switch (state) {
        case constants.SETTINGS_WINDOW_LAUNCH:
            document.getElementById('settingsButton').innerHTML = 'Launch Go.Data'
            document.getElementById('settingDetails').innerHTML = 'Do you want to change the default Go.Data configuration?'
            document.getElementById('typeSelector').style.display = 'flex'

            break
        case constants.SETTINGS_WINDOW_SETTING:
            document.getElementById('settingsButton').innerHTML = 'Save'
            document.getElementById('settingsTitle').innerHTML = 'Go.Data Settings'
            document.getElementById('typeSelector').style.display = 'none'
            break
    }
}

function changeGoDataType(e) {
    goDataType = e.value
    console.log(goDataType)
}
