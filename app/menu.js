'use strict';

const {Menu, shell, clipboard, systemPreferences} = require('electron');

if (typeof systemPreferences.setUserDefault === 'function') {
    // disable dictation and symbols on Mac OS
    systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
    systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
}

/**
 * Get menu template
 * @param url
 * @returns {*[]}
 */
function getMenuTemplate(url) {
    return [
        {
            label: 'Edit',
            submenu: [
                {
                    label: `URL: ${url}`,
                    submenu: [
                        {
                            label: 'Open in browser',
                            click: () => {
                                shell.openExternal(url);
                            }
                        },
                        {
                            label: 'Copy URL',
                            click: () => {
                                clipboard.writeText(url);
                            }
                        }
                    ]
                },
                {role: 'undo'},
                {role: 'redo'}
            ]
        },
        {
            label: 'View',
            submenu: [
                {role: 'reload'},
                {role: 'forcereload'},
                {role: 'toggledevtools'},
                {type: 'separator'},
                {role: 'resetzoom'},
                {role: 'zoomin'},
                {role: 'zoomout'}
            ]
        }
    ]
}

module.exports = {
    getMenu: function (url) {
        return Menu.buildFromTemplate(getMenuTemplate(url));
    }
};