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

loadContract("NameReg", function(cObj) {
    web3.eth.sendTransaction({
        from: web3.eth.coinbase,
        data: cObj.binary,
        gas: 3000000,
        gasPrice: 100000000000000
    }, function(err, res) {
        if (err) throw err;
        console.log("Contract created at address: ", res);
        cObj.addr = res;
        fs.writeFile('contracts.js', '\nvar namereg=' + JSON.stringify(cObj) + ';\nif (typeof module !== "undefined") module.exports=namereg;', process.exit);
    });
});
