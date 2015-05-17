var crypto = require('crypto');
var async = require('async');
var Transaction = require('../node_modules/ethereumjs-lib/lib/transaction.js');
var TransactionStore = require('./txstore');

var DEFAULT_ERR = "Error connecting to api server. Try again later";

var ls = window.localStorage || localStorage;

var db = {
    set: function(key, val) {
        var save = typeof(val) !== 'string' ? JSON.stringify(val) : val;
        ls.setItem(key, save);
    },
    get: function(key) {
        var val = ls.getItem(key);

        if (val && val.length && typeof(val) !== 'string')
            val = JSON.parse(val);
        else if (!val || !val.length) val = null;
        return val;
    }
};

var FabriqWallet = module.exports = function(apiUrl) {
    this.api = apiUrl;
    this.maxRetries = 10;

    this.loadUser = function() {
        this.currentUser = {};
        this.currentUser.authed = db.get('auth') || false;
        this.currentUser.authAttempts = db.get('authAttempts') || 0;
        this.currentUser.txhash = db.get('txhash') || '';
        this.currentUser.pk = db.get("pk") || '';
        this.currentUser.username = db.get("username") || '';
        this.currentUser.addr = db.get("addr") || '';
        this.txstore = new TransactionStore(this.api);
    }

    this.nameAvailable = function(name, cb) {
        $.get(this.api + '/available/' + name, function(data) {
            if (!data || !data.success) return cb(DEFAULT_ERR);
            cb(null, JSON.parse(data.data));
        });
    }

    this.registerUser = function(addr, name, epk, email, cb) {
        var self = this;

        $.post(this.api + '/register', {address: addr, name: name, epk: epk, email: email}, function(data) {
            if (!data || !data.success) return cb(DEFAULT_ERR);
            db.set('txhash', data.data.txhash);
            self.txstore.push('register', [name], data.data.txhash);
            cb(null, data.data);
        });
    }

    this.genAddr = function(pk) {
        var eckey = new Bitcoin.ECKey(pk);
        var publicKeyHex = Crypto.util.bytesToHex(eckey.getPub());
        var words = CryptoJS.enc.Hex.parse(publicKeyHex.slice(2));
        return '0x' + CryptoJS.SHA3(words, {outputLength: 256}).toString().slice(24);
    }
    this.loadUser();
};

// Check if the txhash is success, fail, or nothing
FabriqWallet.prototype.validate = function(cb) {

    var txhash = db.get('txhash'),
        self = this;
    if (!txhash || !txhash.length) return; // cb();
    $.get(this.api + '/log/' + txhash, function(data) {
        var res = null;
        if (data && data.data)
            var res = JSON.parse(data.data);

        if (res && res.success) {
            db.set('auth', true);
            db.set('authAttempt', 0);
            db.set('txhash', '');
            cb(null, res.id);
        } else {
            var authAttempt = db.get('authAttempts') || 0;
            if (authAttempt > self.maxRetries) {
                db.set('authAttempt', 0);
                db.set('txhash', '');
                cb("User registration failed");
            } else {
                db.set('authAttempts', ++authAttempt);
                cb(null);
            }
        }
    });
}

FabriqWallet.prototype.load = function(name, pw, next) {
    var self = this,
        pk,
        pkHex,
        epk,
        user,
        addr;

    function queryUser(cb) {
        $.get(self.api + '/profile/name/' + name, function(data) {
            if (!data || !data.data || !data.data.id) return cb("User '" + name + "' not found");
            user = data.data;
            epk = user.epk;
            cb();
        });
    }

    function decryptKey(cb) {
        try {
            pkHex = CryptoJS.AES.decrypt(epk, pw).toString(CryptoJS.enc.Utf8);
            pk = Crypto.util.hexToBytes(pkHex);
            cb();
        } catch(e) {
            cb("Incorrect password", e);
        }
    }

    function generatePublicKey(cb) {
        addr = self.genAddr(pk);
        cb();
    }

    function authUser(cb) {
        if (addr !== user.addr) {
            cb("Incorrect password");
        } else cb();
    }

    function saveUser(cb) {
        db.set('pk', pkHex);
        db.set('epk', epk);
        db.set('username', name);
        db.set('addr', addr);
        db.set('auth', true);
        cb();
    }

    async.series([
            queryUser,
            decryptKey,
            generatePublicKey,
            authUser,
            saveUser
            ], function(err) {
                if (err) return next(err);
                if (!user || !user.id) return next("user id not found");
                next(null, user.id);
        });
}

FabriqWallet.prototype.create = function(name, pw, email, next) {
    var self = this,
        pk,
        pkHex,
        epk,
        addr;

    function genKey(cb) {
        var randArr = new Uint8Array(32); //create a typed array of 32 bytes (256 bits)
        window.crypto.getRandomValues(randArr); //populate array with cryptographically secure random numbers

        //some Bitcoin and Crypto methods don't like Uint8Array for input. They expect regular JS arrays.
        pk = [];
        for (var i = 0; i < randArr.length; ++i)
            pk[i] = randArr[i];
        cb();
    }

    function encryptKey(cb) {
        pkHex = Crypto.util.bytesToHex(pk);
        epk = CryptoJS.AES.encrypt(pkHex, pw).toString();
        cb();
    }

    function saveUser(cb) {
        db.set('pk', pkHex);
        db.set('epk', epk);
        db.set('username', name);
        db.set('addr', addr);
        db.set('auth', false);
        db.set('authAttempts', 0);
        cb();
    }

    function generatePublicKey(cb) {
        addr = self.genAddr(pk);
        cb();
    }

    this.nameAvailable(name, function(err, avail) {
        if (err) return next(err);
        if (!avail) return next("Name not available");
        async.series([
                genKey,
                encryptKey,
                generatePublicKey,
                saveUser
                ], function(err) {
                    self.loadUser();
                    self.registerUser(addr, name, epk, email, next);
            });
    });
}

FabriqWallet.prototype.logout = function() {
    db.set('pk', '');
    db.set('epk', '');
    db.set('username', '');
    db.set('txhash', '');
    db.set('addr', '');
    db.set('auth', false);
    db.set('authAttempts', 0);
    this.loadUser();
}

FabriqWallet.prototype.beam = function(address, amount, next) {
}

FabriqWallet.prototype.link = function(address, next) {
}

FabriqWallet.prototype.verify = function(address, amount, next) {
}

module.exports = FabriqWallet;
