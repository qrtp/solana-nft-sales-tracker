
// Required libraries
import ibm from 'ibm-cos-sdk';

// global configuration values
var cos
var bucketName
var storageClass

// writeCOSFile writes a file to a COS bucket
export async function writeCOSFile(fileName, contents) {
    return await createTextFile(bucketName, fileName, contents)
}

// readCOSFile reads contents of a file from COS bucket
export async function readCOSFile(fileName) {
    return await getItem(bucketName, fileName)
}

// listCOSFiles retrieves names of items matching a given string
export async function listCOSFiles(matchString) {
    var allBucketItems = await getBucketObjects(bucketName)
    var matchingBucketItems = []
    if (allBucketItems) {
        for (var i = 0; i < allBucketItems.length; i++) {
            if (allBucketItems[i].Key?.includes(matchString) || matchString == "") {
                matchingBucketItems.push(allBucketItems[i].Key)
            }
        }
    }
    return matchingBucketItems
}

// Determines if a given bucket exists
async function bucketExists(name) {
    try {
        const data = await cos.listBuckets().promise()
        if (data.Buckets != null) {
            for (var i = 0; i < data.Buckets.length; i++) {
                if (data.Buckets[i].Name == name) {
                    console.log(`found bucket: ${name}`)
                    return true
                }
            }
        }
    } catch (e) {
        logError(e)
    }
    console.log(`bucket not found: ${name}`)
    return false
}

// Creates a new bucket
async function createBucket(bucketName) {
    console.log(`creating bucket: ${bucketName}`);
    try {
        await cos.createBucket({
            Bucket: bucketName,
            CreateBucketConfiguration: {
                LocationConstraint: storageClass
            },
        }).promise()
        return true
    } catch (e) {
        logError(e)
    }
    return false
}

// Lists all items in specified bucket
async function getBucketObjects(bucketName) {
    try {
        const data = await cos.listObjects({
            Bucket: bucketName,
        }).promise()
        return data.Contents
    } catch (e) {
        logError(e)
    }
    return []
}

// Creates a new text file
async function createTextFile(bucketName, itemName, fileText) {
    console.log(`writing text file to bucket: ${bucketName}, ${itemName}`);
    try {
        await cos.putObject({
            Bucket: bucketName,
            Key: itemName,
            Body: fileText
        }).promise()
        return true
    } catch (e) {
        logError(e)
    }
    return false
}

// Retrieve a particular item from the bucket
async function getItem(bucketName, itemName) {
    console.log(`retrieving text file from bucket: ${bucketName}, key: ${itemName}`);
    try {
        var data = await cos.getObject({
            Bucket: bucketName,
            Key: itemName
        }).promise()
        return Buffer.from(data.Body).toString()
    } catch (e) {
        logError(e)
    }
    return null
}

// initCOS initializes COS instance
export async function initializeCOS(c) {
    try {
        console.log(`configuring COS: ${c.bucket}`)
        var config = {
            ibmAuthEndpoint: "https://iam.cloud.ibm.com/identity/token",
            signatureVersion: "iam",
            endpoint: c.endpoint,
            apiKeyId: c.apikey,
            serviceInstanceId: c.resource_instance_id
        };
        bucketName = c.bucket
        console.log(`bucket ${c.endpoint}`)
        storageClass = c.storageClass
        cos = new ibm.S3(config);
        if (!await bucketExists(bucketName)) {
            return createBucket(bucketName)
        }
        return true
    } catch (e) {
        logError(e)
        return false
    }
}

// Prints errors to console
function logError(e) {
    console.log(`ERROR: ${e.code} - ${e.message}\n`);
}



