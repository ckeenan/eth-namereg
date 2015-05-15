var pg = require('pg');
var web3 = require('web3');
var redis = require('redis');
var async = require('async');
var log4js = require('log4js');

var utils = require('./lib/utils');
var contract = require('./contracts');
var interfaces = require('./lib/interfaces');

var redisHost = process.env.REDIS_HOST || 'localhost';
var redisPort = process.env.REDIS_PORT || 6379;
var nameRegAddr = process.env.NAMREG || contract.addr;

var rpcport = process.env.RPCPORT || 8081;
var rpchost = process.env.RPCHOST || 'localhost';
var logFile = process.env.LOGFILE || 'logs/eventWatch.log';

// PG Config
var pgUser = process.env.PGUSER || 'postgres';
var pgPass = process.env.PGPASS || '';
var pgHost = process.env.PGHOST || 'localhost';
var pgPort = process.env.PGPORT || '5432';
var pgDb = process.env.PGDB || 'fabriq_dev';

var adminAddr = process.env.ADDR || '82a978b3f5962a5b0957d9ee9eef472ee55b42f1';
var adminKey = new Buffer(process.env.KEY || '044852b2a670ade5407e78fb2863c51de9fcb96542a07186fe3aeda6bb8a116d', 'hex');

var pgConnection = 'postgres://' + pgUser + ':' + pgPass + '@' + pgHost + ':' + pgPort + '/' + pgDb;

var ethRpcUrl = 'http://' + rpchost + ':' + rpcport;

log4js.configure({
    appenders: [
        {type: 'console'},
        {type: 'file', filename: logFile, maxLogSize: 20480}
    ]
});

var logger = log4js.getLogger();

var redisClient = redis.createClient(redisPort, redisHost);

web3.setProvider(new web3.providers.HttpProvider(ethRpcUrl));

lastBlock = web3.eth.blockNumber - 1;

var NameReg = web3.eth.contract(contract.abi);
var nameReg = NameReg.at(nameRegAddr);
var nr = new interfaces.NameReg(contract.addr, contract.abi, web3, ethRpcUrl, adminAddr, adminKey);

var events = [
    'registerEvent'
];

function getRange(cb) {
    redisClient.get('currentBlock', function(err, res) {
        if (!res) res = 0;
        cb(err, {
            start: res,
            end: lastBlock
        });
    });
}

function register(args, cb) {
    pg.connect(pgConnection, function(err, client, done) {
        var addr = args.owner;
        logger.info("registering address", addr);
        if (err) {
            done();
            logger.error("error connecting to postgres", err);
            throw err;
            return cb(err);
        }

        nr.getProfile(addr, function(err, profile) {
            if (err) return cb(err);
            client.query("INSERT INTO users (name, address, epk, email, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", 
                    [profile.name, profile.addr, profile.epk, profile.email, new Date(), new Date()], function(err, result) {
                        done();
                        if (err) return cb(err);
                        args.id = result.rows[0].id;
                        // Set the user id in redis for api access (on profile lookup)
                        redisClient.set(profile.addr + '.id', args.id, function(err) {
                            cb(err, args);
                        });
            });
        });
    });
}
function handleMessage(args, cb) {
        if (args.hasOwnProperty('message')  && args.message === 'register') {
            register(args, cb);
        } else cb(null, args);
}

function getLogs(eventName, range, cb) {
    var logEvent = nameReg[eventName]({}, {
        fromBlock: range.start,
        toBlock: range.end
    });

    logEvent.get(function(err, logs) {
        if (err) return cb(err);
        async.each(logs, function(log, next) {
            logger.info("saving", utils.formatHex(log.transactionHash), log.args);
            var msg = log.args.message;
            handleMessage(log.args, function(err, res) {
                if (!err) {
                    redisClient.set(utils.formatHex(log.transactionHash), JSON.stringify(res), function(err, res) {
                        if (err) next(err);
                        else next();
                    });
                } else {
                    logger.warn("Error handling event", log, err);
                    next();
                }
            });
        }, cb);
    });
}

function run(cb) {
    getRange(function(err, range) {
        logger.info("get logs for range", range);
        if (err) return cb(err);
        getLogs('registerEvent', range, cb);
    });
}

run(function(err) {
    if (!err) {
        redisClient.set('currentBlock', lastBlock, function(err, res) {
            if (err) logger.error("error setting currentBlock", err);
            redisClient.end();
            process.exit();
        });
    } else {
        logger.error("uncaught error when running", err);
        throw err;
        process.exit();
    }
});
