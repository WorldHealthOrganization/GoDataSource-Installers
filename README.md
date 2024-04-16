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
    ├── LICENSE
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

Go to the directory on the server.

If there is any previous version on the server, create a directory named as the existing version (i.e. `48.0.0`) and move the following file in the directory:

- Go.Data-Setup.tar.gz

Copy the new 64-bit version file on the server directory:

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

# Terms of Use

Please read these Terms of Use and Software License Agreement (the “**Agreement**”) carefully before installing the Go.Data Software (the “**Software**”).

By installing and/or using the Software, you (the “**Licensee**”) accept all terms, conditions, and requirements of the Agreement. 

## 1. Components of the Software

The Software is a product published by WHO (the “**Software**”) and enables you to input, upload and view your data (the “**Data**”). 

This Agreement governs your use of the Software you have downloaded.

## 2. Third-party software

#### 2.1. Third-party software embedded in the Software.

The Software contains third party open source software components, issued under various open source licenses:

- 0BSD
- AFL-2.1
- BSD-3-Clause
- BSD-2-Clause
- BSD-3-Clause-Clear
- Apache-2.0
- MIT
- MIT-0
- MPL-2.0
- CC-BY-3.0
- CC-BY-4.0
- CC0-1.0
- ISC
- Unlicense
- WTFPL
- AGPL-3.0
- Python-2.0
- BlueOak-1.0.0
- Artistic-2.0
- Zlib
- Ruby

The text of the respective licenses can be found in Annex 2.

#### 2.2. WHO disclaimers for third-party software.

WHO makes no warranties whatsoever, and specifically disclaims any and all warranties, express or implied, that either of the third-party components are free of defects, virus free, able to operate on an uninterrupted basis, merchantable, fit for a particular purpose, accurate, non-infringing or appropriate for your technical system.

#### 2.3. No WHO endorsement of third-party software.

The use of the third-party Components or other third-party software does not imply that these products are endorsed or recommended by WHO in preference to others of a similar nature.

## 3. License and Terms of Use for the Software 

#### Copyright and license. 

The Software is copyright (©) World Health Organization, 2018, and is distributed under the terms of the GNU General Public License version 3 (GPL-3.0). The full license text of the GNU GPL-3.0 can be found below in Annex 1.

## 4. Copyright, Disclaimer and Terms of Use for the Maps 

#### 4.1. 

The boundaries and names shown and the designations used on the maps [embedded in the Software] (the “**Maps**”) do not imply the expression of any opinion whatsoever on the part of WHO concerning the legal status of any country, territory, city or area or of its authorities, or concerning the delimitation of its frontiers or boundaries. Dotted and dashed lines on maps represent approximate border lines for which there may not yet be full agreement. 

#### 4.2. 

Unlike the Software, WHO is not publishing the Maps under the terms of the GNU GPL-3.0. The Maps are not based on “R”, they are an independent and separate work from the Software, and not intended to be distributed as “part of a whole” with the Software.

## 5. Acknowledgment and Use of WHO Name and Emblem

You shall not state or imply that results from the Software are WHO’s products, opinion, or statements. Further, you shall not (i) in connection with your use of the Software, state or imply that WHO endorses or is affiliated with you or your use of the Software, the Software, the Maps, or that WHO endorses any entity, organization, company, or product, or (ii) use the name or emblem of WHO in any way. All requests to use the WHO name and/or emblem require advance written approval of WHO.

## 6. Dispute Resolution

Any matter relating to the interpretation or application of this Agreement which is not covered by its terms shall be resolved by reference to Swiss law. Any dispute relating to the interpretation or application of this Agreement shall, unless amicably settled, be subject to conciliation. In the event of failure of the latter, the dispute shall be settled by arbitration. The arbitration shall be conducted in accordance with the modalities to be agreed upon by the parties or, in the absence of agreement, in accordance with the UNCITRAL Arbitration Rules. The parties shall accept the arbitral award as final.

## 7. Privileges and Immunities of WHO

Nothing contained herein or in any license or terms of use related to the subject matter herein (including, without limitation, the GNU General Public License version 3 mentioned in paragraph 3.1 above) shall be construed as a waiver of any of the privileges and immunities enjoyed by the World Health Organization under national or international law, and/or as submitting the World Health Organization to any national jurisdiction.

Annex 1

- [GNU General Public License Version 3, 29 June 2007](LICENSE)

Annex 2

- [0BSD](https://opensource.org/license/0bsd)
- [AFL-2.1](https://spdx.org/licenses/AFL-2.1.html)
- [BSD-3-Clause](https://opensource.org/license/bsd-3-clause)
- [BSD-2-Clause](https://opensource.org/license/bsd-2-clause)
- [BSD-3-Clause-Clear](https://spdx.org/licenses/BSD-3-Clause-Clear.html)
- [Apache-2.0](https://opensource.org/license/apache-2-0)
- [MIT](https://opensource.org/license/mit)
- [MIT-0](https://opensource.org/license/mit-0)
- [MPL-2.0](https://opensource.org/license/mpl-2-0)
- [CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/legalcode.en)
- [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en)
- [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en)
- [ISC](https://opensource.org/license/isc-license-txt)
- [Unlicense](https://opensource.org/license/unlicense)
- [WTFPL](http://www.wtfpl.net/about/)
- [AGPL-3.0](https://opensource.org/license/agpl-v3)
- [Python-2.0](https://www.python.org/download/releases/2.0/)
- [BlueOak-1.0.0](https://opensource.org/license/blue-oak-model-license)
- [Artistic-2.0](https://opensource.org/license/artistic-2-0)
- [Zlib](https://opensource.org/license/zlib)
- [Ruby](https://spdx.org/licenses/Ruby.html)