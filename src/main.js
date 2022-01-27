var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { PublicKey } from "@solana/web3.js";
import axios from 'axios';
import fs from 'fs';
import _ from 'lodash';
import DiscordHelper from './helpers/discord-helper.js';
import { getMetadata } from './helpers/metadata-helpers.js';
import TwitterHelper from './helpers/twitter-helper.js';
export default class SaleTracker {
    constructor(config, outputType) {
        this.config = config;
        this.auditFilePath = `./auditfile-${outputType}.json`;
        this.airdropFilePath = `./airdrop-${outputType}.json`;
        this.outputType = outputType;
    }
    /**
     * The main function.
     */
    checkSales() {
        return __awaiter(this, void 0, void 0, function* () {
            const me = this;
            let lockFile = me._readOrCreateAuditFile();
            let lastProcessedSignature = _.last(lockFile.processedSignatures);
            console.log("Starting transaction processing at signature: " + lastProcessedSignature);
            let txs = _.reverse(yield me._getHistory(me.config.primaryRoyaltiesAccount, lastProcessedSignature))
            _.remove(txs, tx => {
                return _.includes(lockFile.processedSignatures, tx);
            });
            console.log("Got transactions", txs.length);
            for (let tx of txs) {
                let saleInfo = yield me._parseTransactionForSaleInfo(tx);
                if (saleInfo) {
                    yield me._getOutputPlugin().send(saleInfo);
                    yield me._updateAirdropFile(saleInfo);
                }
                yield me._updateLockFile(tx);
            }
            console.log("Done");
        });
    }



    /**
     * A basic factory to return the output plugin.
     * @returns
     */
    _getOutputPlugin() {
        const me = this;
        if (me.outputType === 'console') {
            return {
                send: function (saleInfo) {
                    return __awaiter(this, void 0, void 0, function* () {
                        console.log(JSON.stringify(saleInfo), null, 2);
                    });
                }
            };
        }
        if (me.outputType === 'discord') {
            return new DiscordHelper(me.config);
        }
        else {
            return new TwitterHelper(me.config);
        }
    }
    /**
     * Returns a dummy audit file for first run.
     * @returns
     */
    _getNewAuditFileStructure() {
        return JSON.stringify({
            processedSignatures: []
        });
    }

    _getNewAirdropFileStructure() {
        return JSON.stringify({
            airdrops: []
        });
    }

    /**
     * Returns the auditfile if it exists, if not createss a new empty one.
     * @returns The contents of the auditfile.
     */
    _readOrCreateAuditFile() {
        const me = this;
        if (fs.existsSync(me.auditFilePath)) {
            return JSON.parse(fs.readFileSync(me.auditFilePath).toString());
        }
        else {
            fs.writeFileSync(me.auditFilePath, me._getNewAuditFileStructure());
            return JSON.parse(fs.readFileSync(me.auditFilePath).toString());
        }
    }
    _readOrCreateAirdropFile() {
        const me = this;
        if (fs.existsSync(me.airdropFilePath)) {
            return JSON.parse(fs.readFileSync(me.airdropFilePath).toString());
        }
        else {
            fs.writeFileSync(me.airdropFilePath, me._getNewAirdropFileStructure());
            return JSON.parse(fs.readFileSync(me.airdropFilePath).toString());
        }
    }

    /**
     * Keeping it simple. Using a file to track processed signatures. Routinely trimming
     * signatures from the file to keep size in check.
     * Improvement: Use a database to store the processed file information - helpes with easier deployment since in the current scheme the lock file is part of the commit.
     * @param signature
     */
    _updateLockFile(signature) {
        return __awaiter(this, void 0, void 0, function* () {
            const me = this;
            let file = me._readOrCreateAuditFile();
            file.processedSignatures.push(signature);
            if (file.processedSignatures.length > 300) {
                file.processedSignatures = _.takeRight(file.processedSignatures, 10);
            }
            yield fs.writeFileSync(me.auditFilePath, JSON.stringify(file));
        });
    }

    _updateAirdropFile(saleInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const me = this;
            let file = me._readOrCreateAirdropFile();
            file.airdrops.push({
                type: "buyer",
                wallet: saleInfo.buyer,
                airdropAmount: 1
            });
            file.airdrops.push({
                type: "seller",
                wallet: saleInfo.seller,
                airdropAmount: 3 * saleInfo.saleAmount
            });
            yield fs.writeFileSync(me.airdropFilePath, JSON.stringify(file));
        });
    }

    /**
     * Gets the mint metadata using the metaplex helper classes.
     * @param mintInfo
     * @returns
     */
    _getMintMetadata(mintInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const me = this;
            let metadata = yield getMetadata(new PublicKey(mintInfo), me.config.rpc);
            return metadata;
        });
    }
    /**
     * Identifies the marketplace using the addresses asssociated with the transaction.
     * The marketplaces have their own royalty addresses which are credited as part of the sale.
     * @param addresses
     * @returns
     */
    _mapMarketPlace(addresses) {
        const me = this;
        let marketPlace = '';
        _.forEach(me.config.marketPlaceInfos, (mpInfo) => {
            if (_.size(_.intersection(addresses, mpInfo.addresses)) > 0) {
                marketPlace = mpInfo.name;
                return false;
            }
        });
        return marketPlace;
    }
    /**
     * The amount debited from the buyer is the actual amount paid for the NFT.
     * @param accountPostBalances - Map of account addresses and the balances post this transaction
     * @param buyer - The buyer address
     * @returns
     */
    _getSaleAmount(accountPostBalances, accountPreBalances, buyer) {
        return _.round(Math.abs(accountPostBalances[buyer] - accountPreBalances[buyer]) / Math.pow(10, 9), 2).toFixed(2);
    }
    /**
     * Some basic ways to avoid people sending fake transactions to our primaryRoyaltiesAccount in an attempt
     * to appear on the sale bots result.
     * @param mintMetadata
     * @returns
     */
    _verifyNFT(mintMetadata) {
        const me = this;
        let creators = _.map(mintMetadata.data.creators, 'address');
        let updateAuthority = _.get(mintMetadata, `updateAuthority`);
        return _.includes(creators, me.config.primaryRoyaltiesAccount) && updateAuthority === me.config.updateAuthority;
    }
    /**
     * Get wallet history until given transaction signature is reached.
     * @param pk - Wallet public key
     * @param untilSignature - Optional end signature
     * @returns
     */
    _getHistory(pk, untilSignature) {
        const me = this;
        let maxCount = 5000
        if (untilSignature == "" || !untilSignature) {
            if (me.config.defaultUntilSignature != "") {
                untilSignature = me.config.defaultUntilSignature
            }
        }
        if (untilSignature == "" || !untilSignature) {
            console.log("no end signagure is set, defaulting max tx to 25")
            maxCount = 25
        } else {
            console.log("getting history until tx", untilSignature)
        }
        return __awaiter(this, void 0, void 0, function* () {
            let txs = []
            let baseURL = 'https://public-api.solscan.io/account/transactions?limit=50&account=' + pk
            while (txs.length < maxCount) {
                let url = baseURL
                if (txs.length > 0) {
                    url = url + "&beforeHash=" + txs[txs.length - 1]
                }
                console.log("Calling", url)
                try {
                    let res = yield axios.get(url)
                    for (let tx of res.data) {
                        if (tx.txHash == untilSignature) {
                            return txs
                        }
                        txs.push(tx.txHash)
                        if (txs.length == maxCount) {
                            break
                        }
                    }
                } catch (e) {
                    console.log("error getting txs", e)
                }
            }
            return txs
        });
    }
    /**
     * Get a transaction in the expected format.
     * @param signature - Transaction signature to retrieve
     * @returns
     */
    _getTransaction(signature) {
        const me = this;
        return __awaiter(this, void 0, void 0, function* () {
            let tx = {
                "transaction": {
                    "message": {
                        "accountKeys": []
                    }
                },
                "meta": {
                    "preTokenBalances": [],
                    "postTokenBalances": [],
                    "preBalances": [],
                    "postBalances": []
                }
            }
            let url = 'https://public-api.solscan.io/transaction/' + signature
            console.log("Calling", url)
            try {
                let res = yield axios.get(url)
                for (let acct of res.data.inputAccount) {
                    tx["transaction"]["message"]["accountKeys"].push(acct.account)
                    tx["meta"]["preBalances"].push(acct.preBalance)
                    tx["meta"]["postBalances"].push(acct.postBalance)
                }
                for (let bal of res.data.tokenBalanes) {
                    tx["meta"]["preTokenBalances"].push({
                        "mint": bal.token.tokenAddress,
                        "amount": bal.amount.preAmount
                    })
                    tx["meta"]["postTokenBalances"].push({
                        "mint": bal.token.tokenAddress,
                        "amount": bal.amount.postAmount
                    })
                }
                tx["blockTime"] = res.data.blockTime
            } catch (e) {
                console.log("error getting tx", e)
            }
            return tx
        });
    }

    /**
     * Get the detailed transaction info, compute account balance changes, identify the marketplaces involved
     * Get the sale amount, get the NFT information from the transaction and thenr retrieve the image from
     * ARWeave.
     * @param signature
     * @returns saleInfo object
     */
    _parseTransactionForSaleInfo(signature) {
        return __awaiter(this, void 0, void 0, function* () {
            const me = this;
            console.log("processing transaction", signature)
            let transactionInfo = yield me._getTransaction(signature);
            let accountKeys = transactionInfo === null || transactionInfo === void 0 ? void 0 : transactionInfo.transaction.message.accountKeys;
            let accountMap = [];
            if (accountKeys) {
                let idx = 0;
                for (let accountKey of accountKeys) {
                    accountMap[idx++] = accountKey;
                }
            }
            let allAddresses = _.values(accountMap);
            let buyer = accountMap[0];
            let { balanceDifferences, seller, mintInfo, saleAmount, marketPlace } = me._parseTransactionMeta(transactionInfo, accountMap, buyer, allAddresses);
            if (balanceDifferences && balanceDifferences[me.config.primaryRoyaltiesAccount] > 0) {

                // if there is not mint data present then no need to continue
                if (!mintInfo || mintInfo == "") {
                    console.log("Not an NFT transaction", signature)
                    return
                }

                // validate the NFT transaction
                let mintMetaData = yield me._getMintMetadata(mintInfo);
                if (!me._verifyNFT(mintMetaData)) {
                    console.log("Not an NFT mint associated with update authority", mintMetaData);
                    return;
                }

                // retrieve sales information for the NFT transaction
                let arWeaveUri = _.get(mintMetaData, `data.uri`);
                let arWeaveInfo = yield axios.get(arWeaveUri);
                return {
                    time: transactionInfo === null || transactionInfo === void 0 ? void 0 : transactionInfo.blockTime,
                    txSignature: signature,
                    marketPlace: marketPlace ? marketPlace : 'Unknown',
                    buyer,
                    seller,
                    saleAmount,
                    nftInfo: {
                        id: _.get(mintMetaData, `data.name`),
                        name: _.get(mintMetaData, `data.name`),
                        image: arWeaveInfo.data.image
                    }
                };
            }
            console.log("Not a transaction we're interested in", signature)
        });
    }
    /**
     * Some rudimentary logic to compute account balance changes. Assumes that the
     * account which is credited the largest amount is the account of the seller.
     * @param transactionInfo
     * @param accountMap
     * @param buyer
     * @param allAddresses
     * @returns
     */
    _parseTransactionMeta(transactionInfo, accountMap, buyer, allAddresses) {
        const me = this;
        let txMetadata = transactionInfo.meta, mintInfo = _.get(txMetadata, `postTokenBalances.0.mint`), balanceDifferences = {}, seller = '';
        let accountPreBalances = {};
        let accountPostBalances = {};
        _.forEach(txMetadata.preBalances, (balance, index) => {
            accountPreBalances[accountMap[index]] = balance;
        });
        _.forEach(txMetadata.postBalances, (balance, index) => {
            accountPostBalances[accountMap[index]] = balance;
        });
        let largestBalanceIncrease = 0;
        _.forEach(accountPostBalances, (balance, address) => {
            let balanceIncrease = accountPostBalances[address] - accountPreBalances[address];
            balanceDifferences[address] = balanceIncrease;
            if (balanceIncrease > largestBalanceIncrease) {
                seller = address;
                largestBalanceIncrease = balanceIncrease;
            }
        });
        return {
            accountPreBalances,
            accountPostBalances,
            balanceDifferences,
            seller,
            mintInfo,
            marketPlace: me._mapMarketPlace(allAddresses),
            saleAmount: me._getSaleAmount(accountPostBalances, accountPreBalances, buyer)
        };
    }
}
