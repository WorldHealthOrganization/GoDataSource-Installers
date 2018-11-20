const fs = require('fs-extra')
const rimraf = require('rimraf')
const path = require('path')

const clientSource = path.join(__dirname, './../go-data/frontend/dist')
const clientDest = path.join(__dirname, './../go-data/api/build/client/dist')
const buildSource = path.join(__dirname, './../go-data/api/build')
const buildDest = path.join(__dirname, './../go-data/build')

/**
 * Remove web app production directory ("go-data/build")
 * Copy frontend production build to API build client directory ("go-data/frontend/dist" to "go-data/api/build/client")
 * Copy API build directory to go-data submodules directory ("go-data/api/build/client" to "go-data"
 */
function build() {
    console.log('Removing build folder...')
    rimraf(buildDest, (err) => {
        if (err) {
            return output(JSON.stringify(err), true)
        }
        console.log('Copying frontend build...')
        fs.copy(clientSource, clientDest, { overwrite: true }, (err) => {
            if (err) {
                return output(JSON.stringify(err), true)
            }
            console.log('Copying API build...')
            fs.copy(buildSource, buildDest, { overwrite: true}, (err) => {
                if (err) {
                    return output(JSON.stringify(err), true)
                }
                output('Successfully copied build folder.', false)
            })
        })
    })
}

/**
 * Output a message to stdout/stderr and end process
 * @param message
 * @param isError
 */
function output(message, isError) {
    // use stderr/stdout per message type
    process[isError ? 'stderr' : 'stdout'].write(`${message}\n`);
    process.exit(isError ? 1 : 0);
}

// Start build
build()