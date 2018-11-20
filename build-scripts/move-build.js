const ncp = require('ncp').ncp

/**
 * Copy frontend production build to API build client directory ("go-data/frontend/dist" to "go-data/api/build/client")
 * Copy API build directory to go-data submodules directory ("go-data/api/build/client" to "go-data"
 */
ncp('./../go-data/frontend/dist', './../go-data/api/build/client/dist', (err) => {
    if (err) {
        output(JSON.stringify(err), true)
    }
    ncp('./../go-data/api/build', './../go-data/build', (err) => {
        if (err) {
            output(JSON.stringify(err), true)
        }
        output('Successfully copied build folder', false)
    })
})

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