const {crashReporter} = require('electron')

const package = require('./paths').desktopApp.package

const init = () => {
  crashReporter.start({
    productName: package.name,
    companyName: package.author,
    submitURL: package.reporter.url,
    uploadToServer: true
  })
}

module.exports = {
  init
}
