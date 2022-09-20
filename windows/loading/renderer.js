// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { ipcRenderer } = require('electron')

ipcRenderer.on('event', (event, arg) => {
    switch (arg) {
        case 'wait':
            document.getElementById('wait-area').textContent = 'It takes approximately 5 - 10 minutes for installation to complete. Thank you for your patience.'
            break
        default:
            document.getElementById('log-area').textContent = arg
            break
    }
})

ipcRenderer.on('error', (event, arg) => {
    document.getElementById('wait-area').textContent = ''
    document.getElementById('log-area').textContent = arg
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
