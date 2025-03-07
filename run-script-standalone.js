/**
 * Use this to run your script directly without the cron.
 * node run-script-standalone.js --config='./config/sample.json' --outputType=console
 * Supported outputTypes are console/discord/twitter.
 */
import fs from 'fs';
import _ from 'lodash';
import yargs from 'yargs';
import { initializeCOS, listCOSFiles, readCOSFile, writeCOSFile } from './src/cos.js';
import SalesTracker from './src/main.js';

let config = {}
let configPath = yargs(process.argv).argv.config;
if (configPath) {
    console.log("retrieving config from file")
    let overrides = yargs(process.argv).argv;
    config = JSON.parse(fs.readFileSync(configPath).toString());
    config = _.assignIn(config, overrides);
} else if (process.env.SOLANA_NFT_SALES_TRACKER_CONFIG) {
    console.log("retrieving config from environment variable")
    config = JSON.parse(process.env.SOLANA_NFT_SALES_TRACKER_CONFIG);
} else {
    console.log("ERROR: no configuration specified")
    process.exit(1)
}

// retrieves list of all projects update authorities
async function getAllProjects() {
    console.log("retrieving all projects")
    var projects = []
    var updateAuthoritiesMap = {}
    var projectIDs = await listCOSFiles("config/prod")
    for (var i = 0; i < projectIDs.length; i++) {
        //read the config
        var projectConfig = JSON.parse(await readCOSFile(projectIDs[i]))
        if (projectConfig) {
            projectConfig.configFilePath = projectIDs[i]
            updateAuthoritiesMap[projectConfig.owner_public_key] = projectConfig
        }
    }
    Object.keys(updateAuthoritiesMap).forEach(function (key) {
        projects.push({
            ownerPublicKey: key,
            isHolder: updateAuthoritiesMap[key].is_holder,
            configFilePath: updateAuthoritiesMap[key].configFilePath,
            projectFiendlyName: updateAuthoritiesMap[key].project_friendly_name,
            projectWebsite: updateAuthoritiesMap[key].project_website,
            updateAuthority: updateAuthoritiesMap[key].update_authority,
            primaryRoyaltiesAccount: updateAuthoritiesMap[key].royalty_wallet_id,
            discordWebhook: updateAuthoritiesMap[key].discord_webhook,
            twitterProjectUsername: updateAuthoritiesMap[key].project_twitter_name,
            twitterConnectedUsername: updateAuthoritiesMap[key].connected_twitter_name,
            twitterAccessToken: updateAuthoritiesMap[key].twitterAccessToken,
            twitterTokenSecret: updateAuthoritiesMap[key].twitterTokenSecret
        })
    })
    console.log(`successfully retrieved all projects: ${JSON.stringify(projects)}`)
    return projects
}

// initialize COS and get the list of all update authorities
if (config.cos && !await initializeCOS(config.cos)) {
    console.log("COS support is required to continue")
    process.exit(1)
}

// write file to indicate running
var lockFileName = "sales-tracker-running"
var successFileName = "sales-tracker-success"
var lockFileContents = await readCOSFile(lockFileName)
console.log(`lock file contents: ${lockFileContents}`)
if (lockFileContents && lockFileContents != "") {

    // is the timeout expired?
    var maxTimeout = 7200
    var elapsedSinceLastRun = (Date.now() - new Date(parseInt(lockFileContents)).getTime()) / 1000
    if (elapsedSinceLastRun < maxTimeout) {
        console.log(`Sales tracker is already running (${elapsedSinceLastRun}s ago), exiting`)
        process.exit(0)
    }
    console.log(`Sales tracker last ran ${elapsedSinceLastRun}s ago`)
}
await writeCOSFile(lockFileName, Date.now().toString())

// retrieve all update authorities and iterate
var startTime = Date.now()
var allProjects = await getAllProjects()
for (var i = 0; i < allProjects.length; i++) {

    // combine base configuration with project configuration
    var trackerConfig = {
        rpc: config.rpc,
        ownerPublicKey: allProjects[i].ownerPublicKey,
        isHolder: allProjects[i].isHolder,
        configFilePath: allProjects[i].configFilePath,
        updateAuthority: allProjects[i].updateAuthority,
        primaryRoyaltiesAccount: allProjects[i].primaryRoyaltiesAccount,
        projectFiendlyName: allProjects[i].projectFiendlyName,
        projectWebsite: allProjects[i].projectWebsite,
        marketPlaceInfos: config.marketPlaceInfos,
        cos: config.cos
    }

    // use default twitter bot configuration for non-holders
    trackerConfig.twitter = {
        connectedUsername: allProjects[i].twitterConnectedUsername,
        projectUsername: allProjects[i].twitterProjectUsername,
        consumerApiKey: config.twitter.consumerApiKey,       // service consumer API key
        consumerApiSecret: config.twitter.consumerApiSecret, // service consumer API secret
        oauth: {
            token: config.twitter.defaultOauthAccessToken,   // default access token for hosted bot
            secret: config.twitter.defaultOauthTokenSecret   // default token secret for hosted bot
        }
    }

    // make holder specific features available
    if (allProjects[i].isHolder) {
        if (allProjects[i].discordWebhook) {
            console.log(`enabling discord sales tracker notifications for ${trackerConfig.updateAuthority}`)
            trackerConfig.discord = {
                webhookUrl: allProjects[i].discordWebhook
            }
        } else {
            console.log(`discord sales tracker notifications not configured ${trackerConfig.updateAuthority}`)
        }
        if (allProjects[i].twitterAccessToken && allProjects[i].twitterTokenSecret) {
            console.log(`enabling custom twitter sales tracker notifications for ${trackerConfig.updateAuthority}`)
            trackerConfig.twitter.oauth = {
                token: allProjects[i].twitterAccessToken, // project specific access token from OAuth handshake
                secret: allProjects[i].twitterTokenSecret // project specific token secret from OAth handshake
            }
        } else {
            console.log(`custom twitter sales tracker notifications not configured ${trackerConfig.updateAuthority}`)
        }
    } else {
        console.log(`sales tracker notifications disabled for ${trackerConfig.updateAuthority}`)
    }

    // run the project sales tracker
    try {
        let tracker = new SalesTracker(trackerConfig, ["console", "cos", "discord", "twitter"]);
        await tracker.checkSales();
    } catch (e) {
        console.log("error tracking sales", trackerConfig, e)
    }
}

// update the sales tracker state
await writeCOSFile(lockFileName, "")
await writeCOSFile(successFileName, Date.now().toString())
var elapsedTime = Date.now() - startTime
console.log(`sales tracking complete in ${elapsedTime}ms for ${allProjects.length} projects`) 
