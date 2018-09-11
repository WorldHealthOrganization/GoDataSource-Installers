/**
 * Downloads an entire bucket from Amazon S3
 * node resources.js --bucket=BUCKETNAME
 */

'use strict'

const argv = require('minimist')(process.argv.slice(2))
const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')

AWS.config = new AWS.Config()
AWS.config.accessKeyId = "AKIAJV62UMHLODGQ6J7A"
AWS.config.secretAccessKey = "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"
AWS.config.region = "us-east-1"

const s3 = new AWS.S3()

// Check for mandatory parameters
if (argv.bucket == undefined) {
    console.log('Please define a --bucket!')
    return
}

// Go!
s3.listObjects({Bucket: argv.bucket}, function (err, data) {
    if (err) console.log(err, err.stack) // an error occurred
    else {

        console.log(data.Contents.length + " files found in '" + argv.bucket + "' bucket")

        data.Contents.forEach(function (currentValue, index, array) {

            // Check if the file already exists?
            fs.exists(path.join(__dirname, currentValue.Key), function (exists) {

                if (exists) {
                    console.log("Skipping: " + currentValue.Key)
                }
                else {
                    console.log("Retrieving: " + currentValue.Key)
                    s3.getObject({Bucket: argv.bucket, Key: currentValue.Key}, function (err, data) {
                        if (err) {
                            console.log(err, err.stack) // an error occurred
                        }
                        else {
                            let objectPath = path.dirname(currentValue.Key)
                            mkdirp.sync(objectPath)
                            fs.writeFile(path.join(__dirname, currentValue.Key), data.Body, function (err) {
                                console.log("Finished: " + currentValue.Key)
                            })
                        }
                    })
                }

            })

        })

    }
})
