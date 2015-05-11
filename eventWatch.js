var web3 = require('web3');
var redis = require('redis');
var async = require('async');

var utils = require('./lib/utils');
var contract = require('./contracts');

var redisHost = process.env.REDIS_HOST || 'localhost';
var redisPort = process.env.REDIS_PORT || 6379;
var nameRegAddr = process.env.NAMREG || contract.addr;

var rpcport = process.env.RPCPORT || 8081;
var rpchost = process.env.RPCHOST || 'localhost';
var logFile = process.env.LOGFILE || 'logs/api.log';

var ethRpcUrl = 'http://' + rpchost + ':' + rpcport;
console.log("ETHRPCURL", ethRpcUrl);


var redisClient = redis.createClient(redisPort, redisHost);

web3.setProvider(new web3.providers.HttpProvider(ethRpcUrl));

lastBlock = web3.eth.blockNumber - 1;

var NameReg = web3.eth.contract(contract.abi);
var nameReg = new NameReg(nameRegAddr);

var events = [
    'registerEvent'
];

function getRange(cb) {
    redisClient.get('currentBlock', function(err, res) {
        res = 0;
        console.log("CurrentBlock", res);
        if (!res) res = 0;
        cb(err, {
            start: res,
            end: lastBlock
        });
    });
}

function getLogs(eventName, range, cb) {
    console.log("EVENT NAME", eventName);
    var logEvent = nameReg[eventName]({}, {
        fromBlock: range.start,
        toBlock: range.end
    });

    logEvent.get(function(err, logs) {
        if (err) return cb(err);
        async.each(logs, function(log, next) {
            console.log("Saving", utils.formatHex(log.transactionHash), log.args);
            redisClient.set(utils.formatHex(log.transactionHash), JSON.stringify(log.args), function(err, res) {
                if (err) next(err);
                else next();
            });
        }, cb);
    });
}

function run(cb) {
    getRange(function(err, range) {
        console.log("getRange", err, range);
        if (err) return cb(err);
        getLogs('registerEvent', range, cb);
    });
}

run(function(err) {
    console.log("ERR", err);
    if (!err) {
        redisClient.set('currentBlock', lastBlock, function(err, res) {
            redisClient.end();
            process.exit();
        });
    } else {
        throw err;
        process.exit();
    }
});
