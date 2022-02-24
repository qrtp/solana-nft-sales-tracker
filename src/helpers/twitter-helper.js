var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from 'axios';
import Twitter from 'twitter';

/**
 * Twitter uses 3 legged oAuth for certain endpoints.
 * You can get the oauth key and secret by simulating the API calls yourselves.
 * You need a approved developer account.
 */
export default class TwitterHelper {
    constructor(config) {
        this.config = config;
        if (this.config.twitter && this.config.twitter.consumerApiKey && this.config.twitter.projectUsername) {
            this.client = new Twitter({
                consumer_key: this.config.twitter.consumerApiKey,
                consumer_secret: this.config.twitter.consumerApiSecret,
                access_token_key: this.config.twitter.oauth.token,
                access_token_secret: this.config.twitter.oauth.secret
            });
        }
    }
    /**
     * Downloads image from a URL and returns it in Base64 format.
     * @param url
     * @returns
     */
    getBase64(url) {
        return axios.get(url, {
            responseType: 'arraybuffer'
        }).then(response => Buffer.from(response.data, 'binary').toString('base64'));
    }
    /**
     * Format your tweet, you can use emojis.
     * @param saleInfo
     * @returns
     */
    formatTweet(saleInfo) {
        var tag = ""
        if (this.config.twitter.projectUsername) {
            var projectUsername = this.config.twitter.projectUsername.replaceAll("@", "")
            var connectedUsername = (this.config.twitter.connectedUsername) ? this.config.twitter.connectedUsername : ""
            if (!this.config.isHolder || projectUsername.toLowerCase() != connectedUsername.toLowerCase()) {
                tag = ` (@${projectUsername})`
            }
        }
        return {
            status: `
  ${this.config.projectFiendlyName}${tag} ${saleInfo.nftInfo.id} purchased for ${saleInfo.saleAmount} SOL 🚀 ➡️ https://solscan.io/tx/${saleInfo.txSignature}
  
  #Solana #NFT
    `
        };
    }
    /**
     * Creates a formatted tweet, uploads the NFT image to twitter and then posts a status update.
     * @param saleInfo
     */
    send(saleInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const me = this;
            if (me.client) {
                let tweetInfo = me.formatTweet(saleInfo);
                let image = yield me.getBase64(`${saleInfo.nftInfo.image}`);
                let mediaUpload;
                try {
                    mediaUpload = yield me.client.post('media/upload', { media_data: image });
                }
                catch (err) {
                    console.log(JSON.stringify(err));
                    throw err;
                }
                yield me.client.post('statuses/update.json', { status: tweetInfo.status, media_ids: mediaUpload.media_id_string });
            }
        });
    }
}
