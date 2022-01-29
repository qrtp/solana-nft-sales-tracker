/**
 * Use this to run your script directly without the cron.
 * node run-script-standalone.js --config='./config/sample.json' --outputType=console
 * Supported outputTypes are console/discord/twitter.
 */
import fs from 'fs';
import _ from 'lodash';
import yargs from 'yargs';
import SalesTracker from './src/main.js';

let config = {}
let configPath = yargs(process.argv).argv.config;
let outputType = "console"
if (configPath) {
    console.log("retrieving config from file")
    let overrides = yargs(process.argv).argv;
    outputType = overrides.outputType || 'console';
    config = JSON.parse(fs.readFileSync(configPath).toString());
    config = _.assignIn(config, overrides);
} else if (process.env.SOLANA_NFT_SALES_TRACKER_CONFIG) {
    console.log("retrieving config from environment variable")
    config = JSON.parse(process.env.SOLANA_NFT_SALES_TRACKER_CONFIG);
} else {
    console.log("ERROR: no configuration specified")
    process.exit(1)
}

let tracker = new SalesTracker(config, outputType);
if (config.cos) {
    if (!await tracker.prepareCOS()) {
        console.log("COS failed to initialize")
        process.exit(1)
    }
    console.log("COS successfully initialized")
}
await tracker.checkSales();