/**
 * Use this to run your script directly without the cron.
 * node run-script-standalone.js --config='./config/sample.json' --outputType=console
 * Supported outputTypes are console/discord/twitter.
 */
import fs from 'fs';
import _ from 'lodash';
import yargs from 'yargs';
import SalesTracker from './src/main.js';

let configPath = yargs(process.argv).argv.config;
let overrides = yargs(process.argv).argv;
let outputType = overrides.outputType || 'console';;

let config = JSON.parse(fs.readFileSync(configPath).toString());
config = _.assignIn(config, overrides);
let tracker = new SalesTracker(config, outputType);
if (config.cos) {
    if (!await tracker.prepareCOS()) {
        console.log("COS failed to initialize")
        process.exit(1)
    }
    console.log("COS successfully initialized")
}
await tracker.checkSales();