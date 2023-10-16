const { notarize } = require('@electron/notarize');

exports.default = function notarizing(context) {
    // data
    const { electronPlatformName, appOutDir } = context;

    // no need to take these steps for win & linux
    if (electronPlatformName !== 'darwin') {
        return Promise.resolve();
    }

    // custom notarize
    console.log(`Alternative app notarization with Apple ID "${process.env.APPLE_ID}". Ignore previous "skipped macOS notarization..."`);

    // notarize
    return notarize({
        tool: 'notarytool',
        appPath: `${appOutDir}/${context.packager.appInfo.productFilename}.app`,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
    }).then(() => {
        // finished
        console.log('Done notarizing app');
    });
};