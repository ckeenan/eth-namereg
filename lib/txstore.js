var async = require('async');

var txtypes = {
    register: {
        pending: [
            "Registering "
            ],
        success: [
            "",
            " registered"
            ],
        timeout: [
            "Could not verify registration of ",
            ": connection timed out"
            ],
        fail: [
            "Could not register ",
            ""
            ]
    },
    beam: {
        pending: [
            "Sending ",
            " tokens to "
            ],
        success: [
            "Sent ",
            " tokens to "
            ],
        timeout: [
            "Could not verify beam of ",
            " tokens to ",
            ": connection timed out"
            ],
        fail: [
            "Could not send ",
            " tokens to "
            ]
    },
    link: {
        pending: [
            "Linking with "
            ],
        success: [
            "Linked with ",
            ],
        timeout: [
            "Could not verify link with ",
            ": connection timed out"
            ],
        fail: [
            "Could not link with ",
            ""
            ]
    },
    editField: {
        pending: [
            "Setting field ",
            " to "
            ],
        success: [
            "",
            " set to "
            ],
        fail: [
            "Could not set ",
            ". Try again later"
            ]
    },
    verify: {
        pending: [
            "Verifying account"
            ],
        success: [
            "Account ",
            " verified"
            ],
        fail: [
            "Could not verify ",
            ""
            ]
    }
};

var defaultWaitTime = 120000;

function currentUser() {
    return localStorage.getItem('addr') || "";
}


var TransactionStore = module.exports = function(apiUrl) {
    this.txDict = {};
    this.txList = [];   // Chronological list
    this.api = apiUrl;

    this.push = function(type, params, id) {
        var tx = new Transaction(type, params, id);
        if (!(id in this.txDict)) {
            this.txDict[id] = tx;
            this.txList.push(id);
        }
        this.save();
    }

    function txTimeCompare(a, b) {
        if (this.txDict[a].timestamp < this.txDict[b].timestamp)
            return -1;
        if (this.txDict[b].timestamp < this.txDict[a].timestamp)
            return 1;
        return 0;
    }

    this.save = function() {
        var saveDict = {},
            self = this;
        Object.keys(this.txDict).map(function(key) {
            var value = self.txDict[key];
            saveDict[key] = [value.typ, value.params, value.id];
        });
        localStorage.setItem(currentUser() + '.' + 'pending', JSON.stringify(saveDict));
    }

    this.load = function() {
        var saveDict = JSON.parse(localStorage.getItem(currentUser() + '.' + 'pending') || '{}');
        this.txDict = {},
            self = this;

        Object.keys(saveDict).map(function(key) {
            var value = saveDict[key];
            self.txDict[key] = new Transaction(value[0], value[1], value[2]);
        });
        this.txList = Object.keys(this.txDict).sort(txTimeCompare.bind(this));
    }

    this.remove = function(tx) {
        delete this.txDict[tx.id];
        this.txList.splice(this.txList.indexOf(tx.id), 1)
        this.save();
    }

    this.checkAll = function(next) {
        var txids = Object.keys(this.txDict),
            self = this,
            results = [];

        async.each(txids, function(id, cb) {
            var tx = self.txDict[id];
            try {
                self.validate(tx, function(result) {
                    if (result !== null) {
                        // On success/fail, remove the UI element
                        results.push({id: tx.id, result: result, msg: tx.msgDict[result]});
                        self.remove(tx);
                    }
                    cb();
                });
            } catch (e) {
                cb(e);
            }
        }, function(err) {
            next(err, results);
        });
    }

    // Validate 1 transaction
    this.validate = function(tx, cb) {
        $.get(this.api + tx.baseUrl, function(data) {
            cb(tx.success(data));
        });
    }

    this.load();
}

var Transaction = function(type, params, id) {
    this.baseUrl = '/log/' + id;
    this.attempts = 0;
    this.params = params;
    this.id = id;
    this.typ = type;

    this.timestamp = +new Date();
    this.msgDict = {};

    if (!type in txtypes) throw "Unsupported transaction type";
    //if (params.length != this.type.message.length) throw "Incorrect parameter count";
    this.type = txtypes[type];

    this.genMessage = function(msgtype) {
        var msg = '';

        for (var i = 0; i < this.type[msgtype].length; i++) {
            msg += this.type[msgtype][i];
            if (i < this.params.length)
                msg += this.params[i];
        }
        return msg;
    }

    for (var msgType in this.type) {
        this.msgDict[msgType] = this.genMessage(msgType);
    }

    // states: succeed, fail, null, other
    this.success = function(payload) {
        var curTime = +new Date();
        if (!payload || curTime - this.timestamp > defaultWaitTime)
            return "timeout";
        if (typeof payload.data === 'string') payload.data = JSON.parse(payload.data);
        if (payload.data && payload.data.success) return "success";
        if (payload.data && payload.data.result) return "success";
        else if (payload.data && (!payload.data.success |payload.data.result)) return "fail";
        else return null;
    }
}
