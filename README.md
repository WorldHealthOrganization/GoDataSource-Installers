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

#### 1. Prerequisites

The project requires `node` and `@angular/cli` globally installed.

#### 2. Getting started

##### Clone the installer project

    git clone git@github.com:ClarisoftTechnologies/Go.Data-Installers.git

##### Install dependencies for the installer project

    npm install

##### Download Mongo & Node binaries
Download the `platforms` directory from S3 with binaries for `mongo` and `node`. These are a few GBs of resources, so you can expect it to take a while.

	npm run setup:resources

##### Install forever-monitor
forever-monitor will be used to launch the Go.Data web app. It will create the `app-management` folder in project root.

    npm run setup:forever

##### Install git submodules
The Go.Data projects (frontend and backend) are included as git submodules. The submodules are cloned via SSH, therefore a SSH key must be added to the Github account used to clone the repositories (<https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/>).

	git submodule init
	git submodule update
This will create the `go-data` folder with the source for Go.Data API (`go-data/api`) and Go.Data frontend (`go-data/frontend`).

##### Setup for Go.Data Web app


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

	This will create the `build` folder for Go.Data API (`go-data/api/build`) and the `dist` folder for Go.Data frontend (`go-data/frontend/dist`).

    **Warning:** The projects must be build with `node 8` (NODE_MODULE_VERSION 57). Make sure that the active version of `node` is 8 by running `node -v` in terminal.

- Move the `dist` folder in the `build/client` folder:

		mv go-data/frontend/dist go-data/api/build/client

- Move the `build` folder in the project root folder:

		mv go-data/api/build go-data

##### Running the installer
At this point, the Go.Data installer project should have the following structure:

    .
    ├── app-management			# Contains the `forever-monitor` node module
    ├── build                   # Contains the app icon
    ├── controllers             # Source files
    ├── go-data                 # The source code and production version of the Go.Data web app
    │	├── api                 # The source code of Go.Data API
	│   ├── build               # The production version of the Go.Data web app
	│   └── frontend            # The source code and of Go.Data frontend
    ├── logger                  # Source files
    ├── platforms				# Downloaded resources for Mongo and Node
    ├── resources				# Contains icons for the installer
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
        VERSION - default (when no OS version is specified) or the OS version (5.5, 6 and 7 for Red Hat and 14 and 16 for Ubuntu)
        NODE_ENV=development
Note: the above configuration does not work as a `npm` script. For some reason, NODE_ENV is undefined when running the configuration from a `npm` script.

Run the Webstorm configuration.

#### 3. Build installers

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
