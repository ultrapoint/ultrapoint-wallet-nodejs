'use strict';

const Curl = require('node-libcurl').Curl;


// helper function to convert Ultrapoint amount to atomic units
function convert (amount) {
    let number = Number(amount) * 1e8;
    // remove any decimals
    number = number.toFixed(0);
    return Number(number);
}

// helper function to build options for ultrapoint's transfer
function buildTransfer (options) {
   
    if (!Object(options) === options) options = {};
    let destinations = options['destinations'] || {};

    if (Array.isArray(destinations)) {
        destinations.forEach((dest) => dest.amount = convert(dest.amount));
    } else {
        destinations.amount = convert(destinations.amount);
        destinations = [destinations];
    }

    let body = {
        method: options['method'],
        params: {
            destinations: destinations,
            mixin: parseInt(options.mixin) || 4,
            unlock_time: parseInt(options.unlockTime) || 0,
            payment_id: options.pid || null,
            do_not_relay: options['do_not_relay'] || false,
            priority: options['priority'] || 0,
            get_tx_hex: options['get_tx_hex'] || false,
            get_tx_key: options['get_tx_key'] || false

        }
    };

     // Set algorithm type if using transfer_split method
     if (options['method'] === "transfer_split") {
         body.params['new_algorithm'] = options['new_algorithm'] || false;
     }

    return body;
}

class Wallet {
    constructor(hostname = '127.0.0.1', port = 17092, username, password = '') {
        
        this.hostname = hostname;
        this.port = port;
        this.username = username;
        this.password = password;
    }
}

// general API wallet request
Wallet.prototype._request = function (body) {

    if (!Object(body) === body) body = {};
    body['jsonrpc'] = '2.0';
    body['id'] = '0';

    // encode the request into JSON
    let requestFields = JSON.stringify(body);

    let curl = new Curl();

    curl.setOpt(Curl.option.TIMEOUT, 30); // maximum time the request is allowed to take
    curl.setOpt(Curl.option.URL, `${this.hostname}:${this.port}/json_rpc`);
    curl.setOpt(Curl.option.HTTPHEADER, ['Content-Type: application/json']);
    curl.setOpt(Curl.option.POST, true);
    if (this.username) {
        curl.setOpt(Curl.option.HTTPAUTH, Curl.auth.DIGEST);
        curl.setOpt(Curl.option.USERPWD, `${this.username}:${this.password}`);
    }
    curl.setOpt(Curl.option.POSTFIELDSIZE, Buffer.byteLength(requestFields, 'utf8'));
    curl.setOpt(Curl.option.POSTFIELDS, requestFields);
    // curl.setOpt(Curl.option.VERBOSE, true);

    let requestPromise = new Promise((resolve, reject) => {

        curl.on('end', function (statusCode, data) {
            try {
                let response = JSON.parse(data);

                if (response && response.result) {
                    resolve(response.result);
                } else if (response && response.error) {
                    resolve(response.error);
                } else {
                    resolve({
                        'error': {
                            'code': statusCode,
                            'response': data,
                            'message': 'Oops, unexpected response from RPC wallet!',
                        }
                    });
                }
            } catch (e) {
                resolve({
                    'error': {
                        'code': statusCode,
                        'response': data,
                        'message': `Parser: ${e.message}`
                    }
                });
            }

            curl.close();
        });

        curl.on('error', () => {
            resolve({ 'error': { 'message': 'Error, unable to resolve RPC wallet!' } });
            curl.close();
        });

        curl.perform();
    });

    return requestPromise;
};

/**
 * Wallet Methods
 * @type {Wallet}
 */

// returns the wallet balance
Wallet.prototype.getBalance = function () {
    let body = {
        method: 'getbalance'
    };
    return this._request(body);
};

// return the wallet address
Wallet.prototype.getAddress = function () {
    let body = {
        method: 'getaddress'
    };
    return this._request(body);
};

// transfer Ultrapoint to a single recipient, or a group of recipients
Wallet.prototype.transfer = function (options) {
    options['method'] = 'transfer';
    let body = buildTransfer(options);
    return this._request(body);
};

// split a transfer into more than one tx if necessary
Wallet.prototype.transferSplit = function (options) {
    options['method'] = 'transfer_split';
    let body = buildTransfer(options);
    return this._request(body);
};

// send all dust outputs back to the wallet with 0 mixin
Wallet.prototype.sweepDust = function () {
    let body = {
        method: 'sweep_dust'
    };
    return this._request(body);
};

// Send all dust output back to a wallet with mixin 0
Wallet.prototype.sweepAll = function (address) {
    let body = {
        method: 'sweep_all',
        params: {
            address: address
        }
    };
    return this._request(body);
};

// get a list of incoming payments using a given payment ID
Wallet.prototype.getPayments = function (pid) {
    let body = {
        method: 'get_payments',
        params: {
            payment_id: pid
        }
    };
    return this._request(body);
};

// get a list of incoming payments using a single payment ID or list of payment IDs from a given height
Wallet.prototype.getBulkPayments = function (pids, minHeight) {
    let body = {
        method: 'get_bulk_payments',
        params: {
            payment_ids: pids,
            min_block_height: minHeight
        }
    };
    return this._request(body);
};

// return a list of incoming transfers to the wallet (type can be "all", "available", or "unavailable")
Wallet.prototype.incomingTransfers = function (type) {
    let body = {
        method: 'incoming_transfers',
        params: {
            transfer_type: type
        }
    };
    return this._request(body);
};

// return the spend key or view private key (type can be 'mnemonic' seed or 'view_key')
Wallet.prototype.queryKey = function (type) {
    let body = {
        method: 'query_key',
        params: {
            key_type: type
        }
    };
    return this._request(body);
};

// make an integrated address from the wallet address and a payment id
Wallet.prototype.makeIntegratedAddress = function (pid) {
    let body = {
        method: 'make_integrated_address',
        params: {
            payment_id: pid
        }
    };
    return this._request(body);
};

// retrieve the standard address and payment id from an integrated address
Wallet.prototype.splitIntegratedAddress = function (address) {
    let body = {
        method: 'split_integrated_address',
        params: {
            integrated_address: address
        }
    };
    return this._request(body);
};

// return the current block height
Wallet.prototype.getHeight = function () {
    let body = {
        method: 'getheight'
    };
    return this._request(body);
};

// Save the blockchain
Wallet.prototype.store = function () {
    let body = {
        method: 'store'
    };
    return this._request(body);
};

// Creates a new wallet
Wallet.prototype.createWallet = function (filename = 'upx_wallet', password = 'ultrapoint', language = 'English') {
    let body = {
        method: 'create_wallet',
        params: {
            filename: filename,
            password: password,
            language: language
        }
    };
    return this._request(body);
};

// Opens a new wallet
Wallet.prototype.openWallet = function (filename = 'upx_wallet', password = 'ultrapoint') {
    let body = {
        method: 'open_wallet',
        params: {
            filename: filename,
            password: password
        }
    };
    return this._request(body);
};

// stop the current ultrapoint-wallet-rpc process
Wallet.prototype.stopWallet = function () {
    let body = {
        method: 'stop_wallet'
    };
    return this._request(body);
};

module.exports = Wallet;
