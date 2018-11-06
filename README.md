# Go.Data installer

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

### 1. Prerequisites

The project requires `node 8` and `@angular/cli` globally installed.

### 2. Getting started

##### 2.1 Clone the installer project

    git clone -b s11 git@github.com:ClarisoftTechnologies/Go.Data-Installers.git

##### 2.2 Install dependencies for the installer project

    npm install

##### 2.3 Download Mongo & Node binaries
Download the `platforms` directory from S3 with binaries for `mongo` and `node`. These are a few GBs of resources, so you can expect it to take a while.

	npm run setup:resources

On Mac OSX and Linux systems, it may be need to changed the permissions to all the files in the folder:

	chmod -R 755 platforms/

##### 2.4 Install forever-monitor
forever-monitor will be used to launch the Go.Data web app. It will create the `app-management` folder in project root.

    npm run setup:forever

##### 2.5 Install git submodules
The Go.Data projects (frontend and backend) are included as git submodules. The submodules are cloned via SSH, therefore a SSH key must be added to the Github account used to clone the repositories (<https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/>).

	git submodule init
	git submodule update
    git submodule foreach git pull origin s11

This will create the `go-data` folder with the source for Go.Data API (`go-data/api`) and Go.Data frontend (`go-data/frontend`).

##### 2.6 Setup for Go.Data Web app


- Install the Go.Data dependencies for the Go.Data API and frontend projects:

    	cd go-data/api
		npm install
		cd ../frontend
		npm install

- Build Go.Data API & Frontend for production:

		cd go-data/api
        npm run build
        cd ../frontend
        npm run build

    In case the api build fails, run the script with node:

    `"build": "node ./node_modules/gulp/bin/gulp.js build"`

    In case the front-end build fails, create another script to increase node allocated memory:

    `"build-prod": "node --max_old_space_size=8000 ./node_modules/@angular/cli/bin/ng build --prod --aot --build-optimizer"`

	This will create the `build` folder for Go.Data API (`go-data/api/build`) and the `dist` folder for Go.Data frontend (`go-data/frontend/dist`).

    **Warning:** The projects must be build with `node 8` (NODE_MODULE_VERSION 57). Make sure that the active version of `node` is 8 by running `node -v` in terminal.

- Move the `dist` folder in the `build/client` folder:

		mv go-data/frontend/dist go-data/api/build/client

- Move the `build` folder in the project root folder:

		mv go-data/api/build go-data

##### 2.7 Running the installer
At this point, the Go.Data installer project should have the following structure:

    .
    ├── app-management          # Contains the `forever-monitor` node module
    ├── build                   # Contains the app icon
    ├── controllers             # Source files
    ├── go-data                 # The source code and production version of the Go.Data web app
    │   ├── api                 # The source code of Go.Data API
    │   ├── build               # The production version of the Go.Data web app
    │   └── frontend            # The source code and of Go.Data frontend
    ├── logger                  # Source files
    ├── platforms               # Downloaded resources for Mongo and Node
    ├── resources               # Contains icons for the installer
    ├── .gitignore
    ├── .gitmodules
    ├── index.html
    ├── LICENSE.md
    ├── main.js
    ├── package.json
    ├── package-lock.json
    ├── README.md
    ├── renderer.js
    └── setup-resources.js

If any of the folders is missing from the project structure, you may have missed a step. It may be a good idea to take a look one more time at the steps above.

Create a Webstorm NodeJS configuration with the following settings:

    Node interpreter: ./node_modules/.bin/electron
    Javascript file: main.js
    Environment variables:
        ARCH - x64 or x86 - will install 64-bit or 32-bit components
        MONGO_PLATFORM - win (for Windows), darwin (for Mac), deb (for Debian), linux (for Linux), rhel (for RHEL) or ubuntu (for Ubuntu)
        NODE_PLATFORM - win (for Windows), darwin (for Mac), linux (for Linux, Debian, RHEL, Ubuntu)
        OSVERSION - default (when no OS version is specified) or the OS version (5.5, 6 and 7 for Red Hat and 14 and 16 for Ubuntu)
        NODE_ENV=development
Note: the above configuration does not work as a `npm` script. For some reason, NODE_ENV is undefined when running the configuration from a `npm` script.

Run the Webstorm configuration.

### 3. Build installers

Check the `package.json` files for building installers. The file contains scripts for packaging `(pack:*)` and distribution `(dist:*)`.

The packaging scripts only create the desktop app. The distribution scripts create the desktop app and also creates the installers.

To build an installer, run `npm run script`, i.e: `npm run pack:osx:64`.

To build all installers, run `npm run pack:*` or `npm run dist:*`.

The environment variables PLATFORM, ARCH and VERSION are read by the installer when copying resources.

The -c.extraMetadata variables are used by the installed app to run node and mongo.

Note: In any script, these variables should have the same value:

    PLATFORM with -c.extraMetadata.PLATFORM
    ARCH with -c.extraMetadata.ARCH
    VERSION with -c.extraMetadata.OSVERSION

##### 3.1. Build for Windows x86

Building for Windows x86 requires a 32-bit Windows machine. The project can be configured on a native 32-bit machine or on a virtual machine with a 32-bit Windows.

It is important to run `npm install` and `npm run build` commands on the 64-bit version because some npm libraries have versions of 32 and 64 bits and the 32 bit versions must be installed.

`npm run dist:win:32`

##### 3.2. Build for Windows x64

Building for Windows x64 requires a 64-bit Windows machine.

It is important to run `npm install` and `npm run build` commands on the 64-bit version because some npm libraries have versions of 32 and 64 bits and the 64 bit versions must be installed.

`npm run dist:win:64`

##### 3.3. Build for Mac x64

Building for Mac OS x64 requires a 64-bit Mac.

`npm run dist:osx:64`

##### 3.4. Build for Linux x86

Building for Linux x86 requires a 32-bit Linux machine. We used Ubuntu 16 x86 to build for all x86 distributions in a virtual machine.

To build the GUI installer:

`npm run dist:linux:32`

To build the CLI installer:

`npm run dist:linux:cli:86`

##### 3.5. Build for Linux x64

Building for Linux x86 requires a 64-bit Linux machine. We used Ubuntu 16 x64 to build for all x64 distributions in a virtual machine.

To build the GUI installer:

`npm run dist:linux:64`

To build the CLI installer:

`npm run dist:linux:cli:64`

### 4. Deploy

The files must be deployed on the same server that is used for auto-update (in this case, <http://54.164.207.48:42000/>).

##### 4.1. General deployment

The deployment is split in 2 directories: `x64` and `x86` with their respective builds.

- Mac deployment: x64 only
- Windows deployment: x86 and x64
- Linux deployment: x86 and x64
- Linux CLI deployment: x86 and x64

##### 4.2. Windows deployment

Go to the `x64` directory on the server.

If there is any previous version on the server, create a directory named as the existing version (i.e. `11.1.0`) and move the following files in the directory:

- Go.Data Setup *version*.exe
- Go.Data Setup *version*.exe.blockmap
- latest.yml

Copy the new 64-bit version files on the server `x64` directory:

- Go.Data Setup *new-version*.exe
- Go.Data Setup *new-version*.exe.blockmap
- latest.yml

Go to the `x86` directory on the server and repeat the steps above with the new 32-bit build.

##### 4.3. Mac deployment

Go to the `x64` directory on the server.

If there is any previous version on the server, create a directory named as the existing version (i.e. `11.1.0`) and move the following files in the directory:

- Go.Data-*version*-mac.zip
- Go.Data-*version*.dmg
- latest-mac.yml

Copy the new version files on the server `x64` directory:

- Go.Data-*new-version*-mac.zip
- Go.Data-*new-version*.dmg
- latest-mac.yml

##### 4.4. Linux deployment

TBD

##### 4.5. Linux CLI deployment

Go to the `x64` directory on the server.

If there is any previous version on the server, create a directory named as the existing version (i.e. `11.1.0`) and move the following file in the directory:

- go-data-linux-x64.tar.gz

Copy the new 64-bit version file on the server `x64` directory:

- go-data-linux-x64.tar.gz

Go to the `x86` directory on the server and repeat the steps above with the new 32-bit build.

##### 4.6. Overview

The `x86` folder structure should be the following:

    .
    ├── old-version-directory-1                                 # i.e. 11.0.0
    ├── old-version-directory-2                                 # i.e. 11.1.0
    ├── old-version-directory-3                                 # i.e. 11.2.0
    ├── old-version-directory-4                                 # i.e. 11.2.1
    ├── go-data-linux-x86.gz                                    # Linux 32-bit CLI installer
    ├── Go.Data Setup version.exe                               # Windows 32-bit installer
    ├── Go.Data Setup version.exe.blockmap                      # file used by Windows auto-updater
    ├── latest.yml                                              # file used by Windows auto-updater
    └── TBD.yml                                                 # file used by Linux auto-updater

The `x64` folder structure should be the following:

    .
    ├── old-version-directory-1                                 # i.e. 11.0.0
    ├── old-version-directory-2                                 # i.e. 11.1.0
    ├── old-version-directory-3                                 # i.e. 11.2.0
    ├── old-version-directory-4                                 # i.e. 11.2.1
    ├── go-data-linux-x64.gz                                    # Linux 64-bit  CLI installer
    ├── Go.Data Setup version.exe                               # Windows 64-bit installer
    ├── Go.Data Setup version.exe.blockma                       # file used by Windows auto-updater
    ├── Go.Data-version-mac.zip                                 # file used by Mac auto-updater
    ├── Go.Data-version.dmg                                     # Mac installer
    ├── latest-mac.yml                                          # file used by Mac auto-updater
    ├── latest.yml                                              # file used by Windows auto-updater
    └── TBD.yml                                                 # file used by Linux auto-updater

### 5. Download installer

The installers are available for 32-bit and 64-bit here: <http://54.164.207.48:42000/>

##### 5.1. Windows installer
- Download the x86 or x64 installer and run.
##### 5.2. Mac installer
- Download the x64 Mac installer and run.
##### 5.3. Linux installer
- TBD
##### 5.4. Linux CLI installer
- Open Terminal and download the x86 or x64 installer

	`wget http://54.164.207.48:42000/x86/go-data-linux-x86.tar.gz`

    `wget http://54.164.207.48:42000/x64/go-data-linux-x64.tar.gz`

- Unzip the files

	`tar -xvzf go-data-linux-x86.tar.gz`

    `tar -xvzf go-data-linux-x64.tar.gz`

- Run the launch script. Optionally, the following arguments can be passed:

	- --dbport
		- specifies the port for Mongo
		- between 1025 and 65535
		- must be different from `port`
		- defaults to `27017`
	- --dbpath
		- specifies the path for Mongo files
		- defaults to `db`
	- --port
		- specifies the port for Go.Data
		- between 1025 and 65535
		- must be different from `dbport`
		- defaults to `8000`
	- --type
		- `hub` or `consolidation`
		- it is not advised to change this value after the first Go.Data launch
		- defaults to `hub`

	`./go-data-x64 --dbport=3001 --dbpath=~/Desktop/db --port=3000 --type=consolidation`

### 6. Auto-updater

The auto-updater is based on the `package.json`version number and the files `updater/app-update-x64.yml` and `updater/app-update-x86.yml`.

To publish a new update, increase the version number in `package.json`, build the app for distribution and upload the following files on the update server:
- for OSX: `.dmg` `.zip` and `lastest-mac.yml` files
- for Windows: `.exe` and `latest.yml` files
- for Linux: TBD
- for Linux CLI: Not available

### 7. Uninstall

##### 7.1. Windows uninstaller
- Uninstall Go.Data from Add or Remove Programs
- Optionally, remove the data folder from `C:\Users\`*`username`*`\AppData\Roaming\GoData`
##### 7.2. Mac uninstaller
- Delete the Go.Data application from /Applications
- Optionally, remove the data folder from `~/Library/Application Support/Go.Data`
##### 7.3. Linux uninstaller
- TBD
##### 7.4. Linux CLI uninstaller
- Remove the folder where GoData was unarchived
- Optionally, remove the folder set as `dbpath`
