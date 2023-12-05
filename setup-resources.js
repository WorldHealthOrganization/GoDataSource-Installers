'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const AdmZip = require('adm-zip');
const rimraf = require('rimraf');
const async = require('async');
const fetch = require('node-fetch');
const convert = require('xml-js');
const { exec } = require('child_process');

// Download resources
Promise.resolve()
    .then(() => new Promise((resolve, reject) => {
        rimraf(
            'platforms',
            (err) => {
                // error ?
                if (err) {
                    reject(err);
                    return;
                }

                // finished
                resolve();
            }
        );
    }))
    .then(() => fetch('https://whomediacenterpsta01.blob.core.windows.net/internet?restype=container&comp=list&prefix=data/godata'))
    .then((res) => res.text())
    .then((xml) => convert.xml2json(
        xml, {
            compact: false,
            spaces: 2
        }
    ))
    .then((jsonText) => JSON.parse(jsonText))
    .then((json) => {
        // try determining os
        let platFormToDownload;
        if (
            process &&
            process.platform
        ) {
            // get platform
            const platform = process.platform.toLowerCase();

            // windows
            if (platform.indexOf('darwin') > -1) {
                platFormToDownload = 'darwin';
            } else if (platform.indexOf('win') > -1) {
                platFormToDownload = 'win';
            } else if (platform.indexOf('linux') > -1) {
                platFormToDownload = 'linux';
            }
        }

        // log
        console.log(`Platform detected: ${platFormToDownload}`);

        // parse through elements
        const platformString = `/platforms/${platFormToDownload}/`;
        const filesToRetrieve = [];
        const goDeeper = (elements) => {
            // nothing to do ?
            if (
                !elements ||
                elements.length < 1
            ) {
                return;
            }

            // go through elements
            elements.forEach((element) => {
                // do we need this one ?
                if (
                    element.type === 'text' &&
                    element.text &&
                    element.text.toLowerCase().startsWith('http') &&
                    element.text.indexOf(platformString) > -1
                ) {
                    // add to list
                    filesToRetrieve.push({
                        path: element.text.substring(element.text.indexOf(platformString) + platformString.length),
                        url: element.text
                    });
                }

                // go deeper ?
                goDeeper(element.elements);
            });
        };

        // parse through elements
        goDeeper(json.elements);

        // log
        console.log(`${filesToRetrieve.length} files found`);

        // finished
        return {
            platFormToDownload,
            filesToRetrieve
        };
    })
    .then((data) => {
        // download file
        const downloadFile = (async (url, path) => {
            const res = await fetch(url);
            const fileStream = fs.createWriteStream(path);
            await new Promise((resolve, reject) => {
                res.body.pipe(fileStream);
                res.body.on("error", reject);
                fileStream.on("finish", resolve);
            });
        });

        // retrieve files
        return new Promise((resolve, reject) => {
            async.series(
                data.filesToRetrieve.map((item) => (callback) => {
                    // create necessary folders
                    const fileFolder = path.join(
                        '.',
                        'platforms',
                        data.platFormToDownload,
                        path.dirname(item.path)
                    );
                    const fileName = path.basename(item.path);
                    mkdirp(fileFolder, { mode: '0777' }, (err) => {
                        // error occurred ?
                        if (err) {
                            callback(err);
                            return;
                        }

                        // log
                        console.log(`Downloading ${item.url}`);

                        // download
                        const filePath = path.join(
                            fileFolder,
                            fileName
                        );
                        downloadFile(
                            item.url,
                            filePath
                        ).then(() => {
                            // log
                            console.log(`Finished downloading ${item.url}`);
                        }).then(() => {
                            // log
                            console.log(`Unzipping file ${filePath}`);

                            // unzip
                            return new Promise((resolve, reject) => {
                                const zip = new AdmZip(filePath);
                                zip.extractAllToAsync(
                                    fileFolder,
                                    true,
                                    false,
                                    (err) => {
                                        // an error occurred ?
                                        if (err) {
                                            reject(err);
                                            return;
                                        }

                                        // log
                                        console.log(`Unzipping file ${filePath} complete!`);

                                        // Remove __MACOSX folder (if existing)
                                        let macosPath = path.join(fileFolder, '__MACOSX');
                                        rimraf(macosPath, (err) => {
                                            // error occurred ?
                                            if (err) {
                                                reject(err);
                                                return;
                                            }

                                            // finished
                                            resolve(filePath);
                                        });
                                    }
                                );
                            });
                        }).then((filePath) => {
                            // log
                            console.log(`Removing zip file ${filePath}`);

                            // remove
                            fs.unlinkSync(filePath);
                        }).then(() => {
                            // we need to do chmod only if MacOS
                            if (data.platFormToDownload !== 'darwin') {
                                return;
                            }

                            // log
                            console.log('MacOS detected, changing file permissions');

                            // change permissions
                            return new Promise((resolve, reject) => {
                                exec(
                                    `chmod -R 0777 "${fileFolder}"`,
                                    (err, stdout, stderr) => {
                                        // error occurred ?
                                        if (err || stderr.length > 0) {
                                            reject(err || new Error(stderr));
                                            return;
                                        }

                                        // finished
                                        resolve();
                                    }
                                );
                            });
                        }).then(() => {
                            // finished
                            callback();
                        }).catch(callback);
                    });
                }),
                (err) => {
                    // error occurred ?
                    if (err) {
                        reject(err);
                        return;
                    }

                    // finished
                    resolve();
                }
            );
        });
    })
    .then(() => {
        console.log('Finished setup resources');
        process.exit(0);
    })
    .catch((err) => {
        process.stderr.write(`${err.toString()}\n`);
        process.exit(1);
    });
