'use strict';

const Curl = require('node-libcurl').Curl;

class Wallet {
    constructor(hostname = '127.0.0.1', port = 17072, username, password = '') {
        
        this.hostname = hostname;
        this.port = port;
        this.username = username;
        this.password = password;
    }
}

// general API wallet request
Wallet.prototype._request = function (body) {
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

// build request body
Wallet.prototype._body = function (method, params) {
    let body = {
        jsonrpc: '2.0',
        id: '0',
        method: method,
        params: params
    };
    return this._request(body);
};

/**
 * Wallet Methods
 * @type {Wallet}
 */

// returns the wallet balance
Wallet.prototype.balance = function() {
    let method = 'getbalance';
    return this._body(method);
};

// return the wallet address
Wallet.prototype.address = function() {
    let method = 'getaddress';
    return this._body(method);
};

// transfer Ultrapoint to a single recipient, or a group of recipients
Wallet.prototype.transfer = function(destinations, options) {
    if(typeof options === 'undefined') options = {};
    if(typeof destinations === 'array') {
        destinations.forEach((dest) => dest.amount = convert(dest.amount));
    } else {
        destinations.amount = convert(destinations.amount);
        destinations = [destinations];
    }
    let method = 'transfer';
    let params = {
        destinations: destinations,
        mixin: parseInt(options.mixin) || 4,
        unlock_time: parseInt(options.unlockTime) || 0,
        payment_id: options.pid || null
    };
    return this._body(method, params);
};

// split a transfer into more than one tx if necessary
Wallet.prototype.transferSplit = function(destinations, options) {
    if(typeof options === 'undefined') options = {};
    if(typeof destinations === 'array') {
        destinations.forEach((dest) => dest.amount = convert(dest.amount));
    } else {
        destinations.amount = convert(destinations.amount);
        destinations = [destinations];
    }
    let method = 'transfer_split';
    let params = {
        destinations: destinations,
        mixin: parseInt(options.mixin) || 4,
        unlock_time: parseInt(options.unlockTime) || 0,
        payment_id: options.pid || null
    };
    return this._body(method, params);
};

// send all dust outputs back to the wallet with 0 mixin
Wallet.prototype.sweep = function() {
    let method = 'sweep_dust';
    return this._body(method);
};

// get a list of incoming payments using a given payment ID
Wallet.prototype.getPayments = function(pid) {
    let method = 'get_payments';
    let params = {};
    params.payment_id = pid;
    return this._body(method, params);
};

// get a list of incoming payments using a single payment ID or list of payment IDs from a given height
Wallet.prototype.getBulkPayments = function(pids, minHeight) {
    let method = 'get_bulk_payments';
    let params = {};
    params.payment_ids = pids;
    params.min_block_height = minHeight;
    return this._body(method, params);
};

// return a list of incoming transfers to the wallet (type can be "all", "available", or "unavailable")
Wallet.prototype.incomingTransfers = function(type) {
    let method = 'incoming_transfers';
    let params = {};
    params.transfer_type = type;
    return this._body(method, params);
};

// return the spend key or view private key (type can be 'mnemonic' seed or 'view_key')
Wallet.prototype.queryKey = function(type) {
    let method = 'query_key';
    let params = {};
    params.key_type = type;
    return this._body(method, params);
};

// make an integrated address from the wallet address and a payment id
Wallet.prototype.integratedAddress = function(pid) {
    let method = 'make_integrated_address';
    let params = {};
    params.payment_id = pid;
    return this._body(method, params);
};

// retrieve the standard address and payment id from an integrated address
Wallet.prototype.splitIntegrated = function(address) {
    let method = 'split_integrated_address';
    let params = {};
    params.integrated_address = address;
    return this._body(method, params);
};

// return the current block height
Wallet.prototype.height = function() {
    let method = 'getheight';
    return this._body(method);
};

// stop the current simplewallet process
Wallet.prototype.stopWallet = function() {
    let method = 'stop_wallet';
    return this._body(method);
};

module.exports = Wallet;

// helper function to convert Ultrapoint amount to atomic units
function convert(amount) {
    let number = Number(amount) * 1e8;
    // remove any decimals
    number = number.toFixed(0);
    return Number(number);
}