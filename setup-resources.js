/**
 * Downloads an entire bucket from Amazon S3
 * node setup-resources.js --bucket=BUCKETNAME
 */

'use strict'

const {Transform} = require('stream')
const fs = require('fs')

const argv = require('minimist')(process.argv.slice(2))
const AWS = require('aws-sdk')

const path = require('path')
const mkdirp = require('mkdirp')
const zip = require('compressing')

const async = require('async')
const _ = require('lodash')

// Set AWS settings
AWS.config = new AWS.Config()
AWS.config.accessKeyId = "AKIAJV62UMHLODGQ6J7A"
AWS.config.secretAccessKey = "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"
AWS.config.region = "us-east-1"

const s3 = new AWS.S3()

// Check for mandatory parameters
if (argv.bucket === undefined) {
    output('No AWS Bucket specified!', true)
    return
}

/**
 * Format a number of bytes in a human-readable format with decimals (i.e Bytes, KB, MB, GB, TB...)
 * @param bytes - Number of bytes to be formatted
 * @param decimals - Number of decimals for the result
 * @return {string} - A string that represents the number in human-readable format
 */
const formatBytes = (bytes, decimals) => {
    if (bytes === 0) return '0 Bytes'
    let k = 1024,
        dm = decimals <= 0 ? 0 : decimals || 2,
        sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Logs progress in form of completed/total
 * @param downloaded - Downloaded bytes
 * @param total - Total bytes
 */
function formattedDownload(downloaded, total) {
    (console.log(`Downloaded\t\t${(downloaded / total * 100).toFixed(2)}%\t\t${formatBytes(downloaded, 2)}/${formatBytes(total, 2)}`))
}

const throttledDownload = _.throttle(formattedDownload, 1000, {leading: true})

/**
 * Download resources from AWS S3
 */
s3.listObjects({Bucket: argv.bucket}, function (err, data) {
    if (err) {
        output(JSON.stringify(err), true)
        return
    }

    console.log(data.Contents.length + " files found in '" + argv.bucket + "' bucket")

    let downloaded = 0
    let unzipped = 0
    let folders = 0
    let total = data.Contents.map(el => el.Size).reduce((accumulator, currentValue) => accumulator + currentValue)

    async.eachOf(
        data.Contents,
        (currentValue, index, callback) => {
            //check if object is folder
            if (currentValue.Key.endsWith('/')) {
                folders++
                // create folder and return
                mkdirp(currentValue.Key, (err) => {
                    if (err) {
                        console.log(`Error creating folder ${currentValue.Key}: ${err.message}`)
                    }
                })
                return callback()
            } else {
                //create folder to save object
                let objectPath = currentValue.Key
                let pathIndex = currentValue.Key.lastIndexOf('/')
                if (pathIndex > 0) {
                    objectPath = currentValue.Key.substring(0, pathIndex)
                }
                mkdirp.sync(objectPath)
            }

            const objectPath = path.join(__dirname, currentValue.Key)
            fs.stat(objectPath, (err, stats) => {
                if (err && err.code !== 'ENOENT') {
                    output(`Error retrieving status for ${currentValue.Key}: ${err.message}`, true)
                    return;
                }

                const unzipFile = (file, callback) => {
                    let fileIndex = file.lastIndexOf('/')
                    let dirPath = file.substring(0, fileIndex)
                    console.log(`Unzipping file ${file} to ${dirPath}...`)
                    zip.zip.uncompress(file, dirPath)
                        .then(() => {
                            console.log(`Unzipping file ${file} complete!`)
                            callback()
                        })
                        .catch((err) => {
                            output(`Error unzipping file ${file} to ${dirPath}: ${err.message}`, true)
                        })
                }

                const afterUnzip = () => {
                    unzipped++
                    if (unzipped === data.Contents.length - folders) {
                        console.log(`Completed unzipping resources`)
                    } else {
                        console.log(`${data.Contents.length - folders - unzipped} files remaining...`)
                    }
                }

                if (stats && stats.size === currentValue.Size) {
                    console.log(`Skipping ${currentValue.Key}`)
                    total -= currentValue.Size
                    unzipFile(currentValue.Key, afterUnzip)
                    return callback()
                }
                if (currentValue.Key.indexOf('.DS_Store') > -1) {
                    return callback()
                }
                console.log(`Downloading ${currentValue.Key}`)

                const logProgress = new Transform({
                    transform(chunk, encoding, callback) {
                        if (chunk) {
                            downloaded += chunk.length
                            throttledDownload(downloaded, total)
                            callback(null, chunk)
                        }
                    }
                })

                s3.getObject({
                    Bucket: argv.bucket,
                    Key: currentValue.Key
                }).createReadStream()
                    .pipe(logProgress)
                    .pipe(fs.createWriteStream(objectPath))
                    .on('error', (err) => {
                        output(`Error downloading file ${currentValue.Key}: ${err.message}`, true)
                    })
                    .on('finish', () => {
                        console.log(`Downloading ${currentValue.Key} complete!`)
                        unzipFile(currentValue.Key, afterUnzip)
                    })
            })
        },
        (err) => {
            console.log(`Completed downloading resources`)
            console.log(`Unzipping ${data.Contents.length - folders} files...`)
            process.exit(0)
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
