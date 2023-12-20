# Go.Data installer

The project creates installers for the following system configurations:

    Windows 64-bit
    MacOS 64-bit
    Linux 64-bit

### 1. Prerequisites

The project requires `node 14.17.5` and `@angular/cli` globally installed.

### 2. Getting started

##### 2.1 Clone the installer project

    git clone ...

##### 2.2 Install dependencies for the installer project

    npm install

##### 2.3 Download Mongo & Node binaries
Download the `platforms` directory with binaries for `mongo` and `node`.

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
    git submodule foreach git pull origin main

This will create the `go-data` folder with the source for Go.Data API (`go-data/api`) and Go.Data frontend (`go-data/frontend`).

##### 2.6 Setup for Go.Data Web app


- Install the Go.Data dependencies for the Go.Data API and frontend projects:

    	cd go-data/api
        nvm use 14.17.5
		npm install
		cd ../frontend
        nvm use 16.18.1
		npm install

- Build Go.Data API & Frontend for production:

		cd go-data/api
        nvm use 14.17.5
        npm run build
        cd ../frontend
        nvm use 16.18.1
        npm run build

	This will create the `build` folder for Go.Data API (`go-data/api/build`) and the `dist` folder for Go.Data frontend (`go-data/frontend/dist`).

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

##### 3.1. Build for Windows x64

Building for Windows x64 requires a 64-bit Windows machine.

`npm run dist:win:64`

##### 3.2. Build for Mac x64

Building for Mac OS x64 requires a 64-bit Mac.

`npm run dist:osx:64`

##### 3.3. Build for Linux x64

Building for Linux x64 requires a 64-bit Linux machine.

`npm run dist:linux:cli:64`

### 4. Deploy

The files must be deployed on the same server that is used for auto-update.

##### 4.1. Windows deployment

Go to the directory on the server.

If there is any previous version on the server, create a directory named as the existing version (i.e. `48.0.0`) and move the following files in the directory:

- Go.Data-Setup.exe
- Go.Data-Setup.exe.blockmap
- latest.yml

Copy the new 64-bit version files on the server directory:

- Go.Data-Setup.exe
- Go.Data-Setup.exe.blockmap
- latest.yml

##### 4.2. Mac deployment

Go to the directory on the server.

If there is any previous version on the server, create a directory named as the existing version (i.e. `48.0.0`) and move the following files in the directory:

- Go.Data-Setup.zip
- Go.Data-Setup.zip.blockmap
- Go.Data-Setup.dmg
- Go.Data-Setup.dmg.blockmap
- latest-mac.yml

Copy the new version files on the server directory:

- Go.Data-Setup.zip
- Go.Data-Setup.zip.blockmap
- Go.Data-Setup.dmg
- Go.Data-Setup.dmg.blockmap
- latest-mac.yml

##### 4.3. Linux deployment

Go to the `x64` directory on the server.

If there is any previous version on the server, create a directory named as the existing version (i.e. `48.0.0`) and move the following file in the directory:

- Go.Data-Setup.tar.gz

Copy the new 64-bit version file on the server `x64` directory:

- Go.Data-Setup.tar.gz

##### 4.4. Overview

The folder structure should be the following:

    .
    ├── Go.Data-Setup.tar.gz                                    # Linux 64-bit  CLI installer
    ├── Go.Data-Setup.exe                                       # Windows 64-bit installer
    ├── Go.Data-Setup.exe.blockmap                              # file used by Windows auto-updater
    ├── Go.Data-Setup.zip                                       # file used by Mac auto-updater
    ├── Go.Data-Setup.zip.blockmap                              # file used by Mac auto-updater
    ├── Go.Data-Setup.dmg                                       # Mac installer
    ├── Go.Data-Setup.dmg.blockmap                              # Mac installer
    ├── latest-mac.yml                                          # file used by Mac auto-updater
    └── latest.yml                                              # file used by Windows auto-updater

### 5. Download installer

##### 5.1. Windows installer
- Download the x64 installer and run.
##### 5.2. Mac installer
- Download the x64 Mac installer and run.
##### 5.3. Linux installer
- Download x64 Linux
- Unzip the files

    `tar -xvzf Go.Data-Setup.tar.gz`

- Run the launch script. Optionally, the following arguments can be passed:

    - --dbport
        - specifies the port for Mongo
        - between 1025 and 65535
        - must be different from `port`
        - defaults to `27000`
    - --dbpath
        - specifies the path for Mongo files
        - defaults to `db`
    - --port
        - specifies the port for Go.Data
        - between 1025 and 65535
        - must be different from `dbport`
        - defaults to `8000`

    `./go-data-x64 --dbport=3001 --dbpath=~/Desktop/db --port=3000

### 6. Auto-updater

The auto-updater is based on the `package.json`version number and the files `updater/app-update-x64.yml`.

### 7. Uninstall

##### 7.1. Windows uninstaller
- Uninstall Go.Data from Add or Remove Programs
- Optionally, remove the data folder from `C:\Users\`*`username`*`\AppData\Roaming\GoData`
##### 7.2. Mac uninstaller
- Delete the Go.Data application from /Applications
- Optionally, remove the data folder from `~/Library/Application Support/Go.Data`
##### 7.3. Linux uninstaller
- Remove the folder where GoData was unarchived
- Optionally, remove the folder set as `dbpath`
