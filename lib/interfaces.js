var Transaction = require('ethereumjs-lib').Transaction;
var async = require('async');
var utils = require('./utils');
//500 eth
//var account_value = 500000000000000000000;
//50 eth
var account_value = 50000000000000000000;

var NameReg = exports.NameReg = function(addr, abi, web3, ethRpcUrl, adminAddr, adminKey) {
    this.register_data_base = web3.sha3(web3.fromAscii('register(address,bytes32,bytes32[],bytes32[])')).slice(2, 10);
    this.nameRegABI = web3.eth.contract(abi);
    this.nameReg = this.nameRegABI.at(addr);

    this.admin = {
        addr: adminAddr,
        key: adminKey
    };

    this.registerTxBase = {
        gasPrice: 10000000000000,
        gasLimit: 342000,
        to: addr
    };

    this.getProfileField = function(addr, field, next) {
        var bytes = '';
        var element = '';
        var index = 0;
        var self = this;
        async.doWhilst(function(cb) {
            element = self.nameReg.userData(addr, field, index++);
            bytes += element;
            cb();
        }, function() {
            return element.length > 0;
        }, function(err) {
            next(err, bytes);
        });
    }


    this.getProfile = function(addr, next) {
        var self = this;
        var profile = {};
        profile.name = this.nameReg.nameByAddr(addr);
        profile.addr = addr;
        async.each([
                'epk',
                'email'
        ], function(field, cb) {
            self.getProfileField(addr, field, function(err, bytes) {
                profile[field] = bytes;
                cb(err);
            });
        }, function(err) {
            next(err, profile);
        });
    }

    this.formatBytes = function(strData, next) {
        var strchunks = strData.match(/.{1,32}/g);
        var bytes = '';

        async.eachSeries(strchunks, function(chunk, cb) {
            try {
                bytes += web3.fromAscii(chunk, 32).slice(2);
                cb();
            } catch (e) { cb(e); }
        }, function(err) {
            next(err, bytes);
        });
    }

    this.register = function(addr, name, epk, email, next) {
        var data = this.register_data_base;
        var self = this;

        // user eth address
        data += utils.pad(utils.formatHex(addr), 64);

        // profile name
        data += web3.fromAscii(name.slice(0,32), 32).slice(2);

        // profile fields
        data += utils.pad(web3.toHex(Math.ceil(epk.length/32)).slice(2), 64);
        data += utils.pad(web3.toHex(Math.ceil(email.length/32)).slice(2), 64);

        async.eachSeries([
                epk,
                email
        ], function(input, cb) {
            self.formatBytes(input, function(err, bytes) {
                data += bytes;
                cb(err);
            });
        }, function(err) {
            if (err) return next(err);

            var tx = new Transaction(self.registerTxBase);

            web3.eth.getTransactionCount(utils.formatHex(self.admin.addr, true), function(err, nonce) {
                if (err) return next(err);
                tx.nonce = nonce == 0 ? "" : nonce;
                tx.value = account_value;
                tx.data = data;
                tx.sign(self.admin.key);

                utils.ethrpc(ethRpcUrl, 'eth_injectTransaction', tx.serialize().toString('hex'), function(err, response) {
                    var body = {};

                    try {
                        body = JSON.parse(response.body);
                    } catch (e) {
                        if (!err) err = "error loading eth_injectTransaction response body";
                    }

                    body.txhash = tx.hash(false).toString('hex');
                    next(err, body);
                });
            });
        });
    }
};
