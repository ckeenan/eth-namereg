var web3 = require('web3');
var path = require('path');
var fs = require('fs');
var async = require('async');

var RPC_PORT = process.env.RPCPORT || 8080;
var RPC_HOST = process.env.RPCHOST || 'localhost';
var ethRpcUrl = 'http://' + RPC_HOST + ':' + RPC_PORT;


web3.setProvider(new web3.providers.HttpProvider(ethRpcUrl));

function loadContract(name, done) {
    var endings = ['abi', 'binary'];

    var contract = {
        name: name,
        binary: '0x',
        abi: {}
    };

    async.eachSeries(endings,
        function(ending, cb) {
            fs.readFile(path.join('contracts/', name + '.' + ending), function(err, output) {
                if (err) throw err;

                var out = '0x' + output.toString();
                if (ending == 'abi')
                    out = JSON.parse(output.toString());

                contract[ending] = out;
                cb();
            });
        }, function(err) {
        done(contract);
    });
}

var contracts = {};
function sendContract(name, cb) {
    loadContract(name, function(cObj) {
        web3.eth.sendTransaction({
            from: web3.eth.coinbase,
            data: cObj.binary,
            gas: 3000000,
            gasPrice: 100000000000000
        }, function(err, res) {
            if (err) throw err;
            console.log("Contract created at address: ", res);
            cObj.addr = res;
            contracts[name] = cObj;
            // Wait for block
            setTimeout(cb, 20000);
        });
    });
}

sendContract("NameReg", function() {
    sendContract("Rep_Trimmed", function() {
        writeContractFile(process.exit);
    });
});

function writeContractFile(cb) {
    var vars = '';
    var exports = 'if (typeof module !== "undefined") module.exports= {';
    Object.keys(contracts).forEach(function(key) {
        vars += '\nvar ' + key + ' = ' + JSON.stringify(contracts[key]) + ';';
        exports += '\n\t' + key + ': ' + key + ',';
    });
    exports += '\n};';
    fs.writeFile('contracts.js', vars + exports, cb);
}
