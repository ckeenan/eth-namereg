var Transaction = require('ethereumjs-lib').Transaction;
var async = require('async');
var utils = require('./utils');
var account_value = 1000000;

var NameReg = exports.NameReg = function(addr, abi, web3, ethRpcUrl, adminAddr, adminKey) {
    this.register_data_base = web3.sha3(web3.fromAscii('register(address,bytes32,bytes,bytes)')).slice(2, 10);
    this.nameRegABI = web3.eth.contract(abi);
    this.nameReg = this.nameRegABI.at(addr);

    this.admin = {
        addr: adminAddr,
        key: adminKey
    };

    this.registerTxBase = {
        gasPrice: 10000000000000,
        gasLimit: 342000,
        value: 100,
        to: addr
    };

    this.getProfileField = function(addr, field, next) {

        var length = this.nameReg.userDataLen(addr, field);

        console.log("GetProfile field", addr, field, length.toString());

        var bytes = Array(length);

        var indices = Array.apply(null, {length: length}).map(Number.call, Number);
        var bytes = Array(length);

        var self = this;
        async.each(indices, function(index, cb) {
            try {
                bytes[index] = self.nameReg.userData(addr, field, index);
                cb();
            } catch(e) {
                cb(e);
            }
        }, function(err) {
            next(err, bytes.join(''));
        });
    };

    this.getProfile = function(addr, next) {
        console.log("Get profile", addr);
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
                bytes += utils.pad(web3.fromAscii(chunk.split("").reverse().join("")).slice(2), 64);
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

        // profile body text
        //data += utils.pad(web3.toHex(body.length).slice(2), 64);

        data += utils.pad(web3.toHex(epk.length).slice(2), 64);
        data += utils.pad(web3.toHex(email.length).slice(2), 64);

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

            console.log("Registering", data);

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
