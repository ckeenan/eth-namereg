var web3 = require('web3');
var express = require('express');
var log4js = require('log4js');
var async = require('async');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');
var redis = require('redis');

var interfaces = require('./lib/interfaces');
var utils = require('./lib/utils');
var contract = require('./contracts');

// ENV configs
var redisHost = process.env.REDIS_HOST || 'localhost';
var redisPort = process.env.REDIS_PORT || 6379;
var port = process.env.PORT || 8000;
var NOCACHE = process.env.NOCACHE || false;

// TODO: Change these defaults to something other than SHA3(1) :) (also probably should change the 
var adminKey = new Buffer(process.env.KEY || '044852b2a670ade5407e78fb2863c51de9fcb96542a07186fe3aeda6bb8a116d', 'hex');
var adminAddr = process.env.ADDR || '82a978b3f5962a5b0957d9ee9eef472ee55b42f1';

var nameRegAddr = process.env.NAMREG || contract.addr;
var rpcport = process.env.RPCPORT || 8080;
var rpchost = process.env.RPCHOST || 'localhost';
var logFile = process.env.LOGFILE || 'logs/api.log';

var redisClient = redis.createClient(redisPort, redisHost);

var ethRpcUrl = 'http://' + rpchost + ':' + rpcport;
web3.setProvider(new web3.providers.HttpProvider(ethRpcUrl));

log4js.configure({
    appenders: [
        {type: 'console'},
        {type: 'file', filename: logFile, maxLogSize: 20480}
    ]
});


var logger = log4js.getLogger();

var debugLogs = function(req, res, next) {
    var input = Object.keys(req.params).length ? req.params : req.body;
    logger.debug(req.url, JSON.stringify(input), req.connection.remoteAddress);
    next();
}

var cached = function(req, res, next) {
    if (req.method !== 'GET') return next();
    if (NOCACHE) return next();
    var cache = {success: false, data: {}};

    redisClient.get(req.url, function(err, reply) {
        if (!err && reply) cache = {success: true, data: reply};
        req.cache = cache;
        console.log("cache", req.cache);
        next();
    });
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(debugLogs);

var NameReg = web3.eth.contract(contract.abi);
var nameReg = NameReg.at(contract.addr);

var nr = new interfaces.NameReg(contract.addr, contract.abi, web3, ethRpcUrl, adminAddr, adminKey);

app.listen(port);

app.post('/inject', function(req, res) {
    var tx = req.body.rawtx;
    if (!tx || !tx.length || tx == '0x') return res.end("False");
    if (tx.slice(0,2) == '0x') tx = tx.slice(2);

    var msg = {
        'jsonrpc': '2.0',
        'method': 'eth_injectTransaction',
        'params': ['0x' + tx],
        'id': 0
    };

    request.post(ethRpcUrl, {form: JSON.stringify(msg)}, function(err, response, body) {
        if (err) return res.json({success: false, data: err});
        res.json({success: true, data: body});
    });
});

// Register a new account on contract
app.post('/register', function(req, res) {
    nr.register(req.body.address, req.body.name, req.body.epk, req.body.email, function(err, response) {
        res.json({success: !err, data: err ? err : response});
    });
});

app.get('/available/:username', function(req, res) {
    var err = null;
    var result = false;
    try {
        result = web3.toDecimal(nameReg.addrByName(req.params.username)) == 0;
    } catch (e) {
        err = e;
    }
    res.json({success: !err, data: err ? err : result});
});

app.get('/profile/name/:username/:field', cached, function(req, res) {
    nr.getProfileField(nameReg.addrByName(req.params.username), function(err, profileField) {
        if (err) res.json({success: false, data: err});
        else {
            redisClient.set(req.url, profileField);
            res.json({success: true, data: profileField});
        }
    });
});

app.get('/profile/address/:address/:field', cached, function(req, res) {
    nr.getProfileField(req.params.address, req.params.field, function(err, profileField) {
        if (err) res.json({success: false, data: err});
        else {
            redisClient.set(req.url, profileField);
            res.json({success: true, data: profileField});
        }
    });
});

app.get('/profile/name/:username', cached, function(req, res) {
    if (req.cache && req.cache.success) return res.json(req.cache);
    nr.getProfile(nameReg.addrByName(req.params.username), function(err, profile) {
        if (err) res.json({success: false, data: err});
        else {
            redisClient.set(req.url, profile);
            res.json({success: true, data: profile});
        }
    });
});

app.get('/profile/address/:addr', cached, function(req, res) {
    nr.getProfile(req.params.addr, function(err, profile) {
        if (err) res.json({success: false, data: err});
        else {
            redisClient.set(req.url, profile);
            res.json({success: true, data: profile});
        }
    });
});

app.get('/log/:txhash', function(req, res) {
    redisClient.get(utils.formatHex(req.params.txhash), function(err, reply) {
        res.json({success: !err, data: err ? err : reply});
    });
});

app.get('/tx/:txhash', cached, function(req, res) {
    var txhash = req.params.txhash;

    if (!req.cache.success)
        web3.eth.getTransaction(txhash, function(err, res) {
            if (err) res.json({success: false, data: err});
            else {
                redisClient.set(txhash, res);
                res.json({success: true, data: res});
            }
        });
    else res.json(req.cache);
});

app.get('/nonce/:address', function(req, res) {
    web3.eth.getTransactionCount(req.params.address, function(err, nonce) {
        res.json({success: !err, data: nonce});
    });
});
