var web3 = require('web3');
var contracts = require('./contracts');
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8080'));
var RepJSON = contracts.Rep_Trimmed;
var Rep = web3.eth.contract(RepJSON.abi);
var rep = Rep.at(RepJSON.addr);
var fromAddr = web3.eth.coinbase;
console.log("addr", RepJSON.addr);

rep.setReward.sendTransaction("init", 100, {from: web3.eth.coinbase, gas: 3000000, gasPrice: 10000000000000});
