// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { ipcRenderer } = require('electron')

ipcRenderer.on('event', (event, arg) => {
    document.getElementById('log-area').textContent = arg
})

ipcRenderer.on('error', (event, arg) => {
    document.getElementById('button-container').style.display = 'block'
})

let openLogs = document.getElementById('logs-button')
openLogs.onclick = () => {
    ipcRenderer.send('open-logs-message', '')
}

let exit = document.getElementById('exit-button')
exit.onclick = () => {
    ipcRenderer.send('exit-message', '')
}
