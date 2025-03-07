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

// create HTTP client with 60 second timeout
const axiosInstance = axios.create()
axiosInstance.defaults.timeout = 60000

/**
 * Just setup a new channel in discord, then go to settings, integrations and created a new webhook
 * Set the webhook URL in the config.json.
 */
export default class DiscordHelper {
    constructor(config) {
        this.config = config;
    }
    _createWebhookData(saleInfo) {
        return {
            "username": "NFT 4 Cause Sales Bot",
            "embeds": [
                {
                    "author": {
                        "name": "NFT 4 Cause Sales Bot"
                    },
                    "fields": [
                        {
                            "name": "Price",
                            "value": saleInfo.saleAmount
                        },
                        {
                            "name": "Seller",
                            "value": saleInfo.seller,
                            "inline": true
                        },
                        {
                            "name": "Buyer",
                            "value": saleInfo.buyer,
                            "inline": true
                        },
                        {
                            "name": "Transaction ID",
                            "value": saleInfo.txSignature,
                            "inline": false
                        },
                        {
                            "name": "Marketplace",
                            "value": (saleInfo.seller == this.config.primaryRoyaltiesAccount) ? "Mint" : saleInfo.marketPlace,
                            "inline": false
                        }
                    ],
                    "color": 14303591,
                    "title": `${saleInfo.nftInfo.id} → SOLD`,
                    "url": `https://explorer.solana.com/tx/${saleInfo.txSignature}`,
                    "thumbnail": {
                        "url": `${saleInfo.nftInfo.image}`
                    },
                    "timestamp": new Date(saleInfo.time * 1000).toISOString()
                }
            ]
        };
    }
    send(saleInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const me = this;
            if (this.config.discord && this.config.discord.webhookUrl) {
                yield axiosInstance.post(this.config.discord.webhookUrl, me._createWebhookData(saleInfo));
            }
        });
    }
}
