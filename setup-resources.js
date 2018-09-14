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

const async = require('async')
const _ = require('lodash')

AWS.config = new AWS.Config()
AWS.config.accessKeyId = "AKIAJV62UMHLODGQ6J7A"
AWS.config.secretAccessKey = "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"
AWS.config.region = "us-east-1"

const s3 = new AWS.S3()

// Check for mandatory parameters
if (argv.bucket === undefined) {
    console.log('Please define a --bucket!')
    return
}

const formatBytes = (bytes, decimals) => {
    if (bytes === 0) return '0 Bytes'
    let k = 1024,
        dm = decimals <= 0 ? 0 : decimals || 2,
        sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function formattedDownload(downloaded, total) {
    (console.log(`Downloaded\t\t${(downloaded / total * 100).toFixed(2)}%\t\t${formatBytes(downloaded, 2)}/${formatBytes(total, 2)}`))
}

const throttledDownload = _.throttle(formattedDownload, 1000, {leading: true})

s3.listObjects({Bucket: argv.bucket}, function (err, data) {
    if (err) {
        console.log(err, err.stack) // an error occurred
        return
    }

    console.log(data.Contents.length + " files found in '" + argv.bucket + "' bucket")

    let downloaded = 0
    let total = data.Contents.map(el => el.Size).reduce((accumulator, currentValue) => accumulator + currentValue)

    async.eachOf(
        data.Contents,
        (currentValue, index, callback) => {
            //check if ogject is folder
            if (currentValue.Key.endsWith('/')) {
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
                    console.log(`Error retrieving status for ${currentValue.Key}: ${err.message}`)
                    return callback(err)
                }
                if (stats && stats.size === currentValue.Size) {
                    console.log(`Skipping ${currentValue.Key}`)
                    total -= currentValue.Size
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
                        callback(err)
                    })
                    .on('finish', () => {
                        console.log(`Downloading ${currentValue.Key} complete!`)
                        fs.chmod(objectPath, '755', callback);
                    })
            })
        },
        (err) => {
            console.log(`Completed downloading resources`)
        })
})
