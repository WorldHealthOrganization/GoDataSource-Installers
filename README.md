# Go.Data installer

1. Installer configuration

The project creates installers for the following system configurations:
    Windows 64-bit and 32-bit
    MacOS 64-bit
    Linux 64-bit and 32-bit
        Debian 64-bit
        Red Hat 7 64-bit
        Red Hat 6 64-bit
        Red Hat 5.5 64-bit
        Ubuntu 16 64-bit
        Ubuntu 14 64-bit

For Linux distributions with versions not specified above, the universal Linux installer will be used.
For instance, a user working on a system with Ubuntu 15 will install the 32-bit or 64-bit Linux installer.

2. Run project

Run `npm install`.
Create a Webstorm NodeJS configuration with the following settings:
    Node interpreter: ./node_modules/.bin/electron
    Javascript file: main.js
    Environment variables:
        ARCH - x64 or x86 - will install 64-bit or 32-bit components
        PLATFORM - win (for Windows), darwin (for Mac), deb (for Debian), linux (for Linux), rhel (for RHEL) or ubuntu (for Ubuntu)
        VERSION - default (when no OS version is specified) or the OS version (5.5, 6 and 7 for Red Hat and 14 and 16 for Ubuntu)
        NODE_ENV=development
Note: the above configuration does not work as a package.json script. For some reason, NODE_ENV is undefined when running the configuration from a package.json script.
Run the Webstorm configuration.

3. Build installers

Check the package.json files for building installers. The file contains scripts for packaging (pack:*) and distribution (dist:*).
The packaging scripts only create the desktop app. The distribution scripts create the desktop app and also creates the installers.
To build an installer, run `npm run script`, i.e: `npm run pack:osx:64`.
To build all installers, run `npm run pack:*` or `npm run dist:*`.

The environment variables PLATFORM, ARCH and VERSION are read by the installer when copying resources.
The -c.extraMetadata variables are used by the installed app to run node and mongo.
Note: In any script, these variables should have the same value:
    PLATFORM with -c.extraMetadata.PLATFORM
    ARCH with -c.extraMetadata.ARCH
    VERSION with -c.extraMetadata.OSVERSION
