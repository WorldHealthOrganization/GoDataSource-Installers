// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { ipcRenderer } = require('electron');
const constants = require('./../../utils/constants');

let platform = null;

function setButtonFunctionality() {
    document.getElementById('settingsButton').onclick = () => {
        document.getElementById('settingsButton').disabled = true;
        ipcRenderer.send(
            'buttonClick-message', {
                mongoPort: document.getElementById('mongoPort').value,
                goDataPort: document.getElementById('goDataPort').value,
                encryption: document.getElementById('encryptionSwitch').checked
            }
        )
    }
}

function bindEncryption() {
    let encryptionToggle = document.getElementById('encryptionSwitch');
    encryptionToggle.onclick = () => {
        ipcRenderer.send('toggleEncryption-message', document.getElementById('encryptionSwitch').checked);
    }
}

function loadView(state) {
    switch (state) {
        case constants.SETTINGS_WINDOW_LAUNCH:
            document.getElementById('settingsButton').innerHTML = 'Launch Go.Data';

            break;
        case constants.SETTINGS_WINDOW_SETTING:
            document.getElementById('settingsButton').innerHTML = 'Save';
            break
    }
    document.getElementById('settingsButton').disabled = true;
}

ipcRenderer.on('getState-reply', (event, arg) => {
    loadView(arg);
    setButtonFunctionality();
    bindEncryption();
});

ipcRenderer.on('getDBPort-reply', (event, arg) => {
    document.getElementById('mongoPort').value = arg;
});

ipcRenderer.on('getGoDataPort-reply', (event, arg) => {
    document.getElementById('goDataPort').value = arg;
});

ipcRenderer.on('getProductVersion-reply', (event, version, appPlatform) => {
    platform = appPlatform;
    document.getElementById('productVersion').innerHTML = version;
});

ipcRenderer.on('getBuildNumber-reply', (event, version) => {
    document.getElementById('productBuildNumber').innerHTML = `Build ${version}`;
});

ipcRenderer.on('getPublicInfo-reply', (event, apiSettings) => {
    document.getElementById('enableConfigRewriteSwitch').checked = apiSettings.enableConfigRewrite;
    document.getElementById('enableConfigRewriteSwitch').style.display = 'block';
    document.getElementById('publicProtocol').value = apiSettings.public && apiSettings.public.protocol ?
        apiSettings.public.protocol :
        'http';
    document.getElementById('publicHost').value = apiSettings.public && apiSettings.public.host ?
        apiSettings.public.host :
        '';
    document.getElementById('publicPort').value = apiSettings.public && apiSettings.public.port ?
        apiSettings.public.port :
        '';
    configRewriteSwitchChanged();
});

ipcRenderer.on('getEncryptionCapabilities-reply', (event, err, capability, status) => {
    document.getElementById('settingsButton').disabled = false;
    if (err) {
        document.getElementById('encryptionLabel').innerHTML = `Error retrieving encryption settings`;
    } else if (!capability) {
        document.getElementById('encryptionLabel').innerHTML = 'Go.Data is unable to apply its own encryption. Your machine may still have encryption enabled using another method.';
    } else {
        document.getElementById('encryptionLabel').innerHTML = `Encrypt data ${platform === 'darwin' ? 'with FileVault' : ''}`;
        document.getElementById('encryptionSwitch').checked = status;
        document.getElementById('encryptionSwitch').style.display = 'block';
    }
});

ipcRenderer.send('getState-message', '');
ipcRenderer.send('getDbPort-message', '');
ipcRenderer.send('getGoDataPort-message', '');
ipcRenderer.send('getProductVersion-message', '');
ipcRenderer.send('getBuildNumber-message', '');
ipcRenderer.send('getPublicInfo-message', '');
ipcRenderer.send('getEncryptionCapabilities-message', '');
