var childProcess = require('child_process');
var superagent = require('superagent');
var ethjs = require('ethereumjs-lib');
var assert = require('assert');
var web3 = require('web3');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8080'));

var namereg = require('../contracts');
var NameReg = web3.eth.contract(namereg.abi);
var nameReg = NameReg.at(namereg.addr);

var API_PORT = process.env.API_PORT || 8000;
var API_HOST = process.env.API_HOST || 'localhost';

var url_base = 'http://' + API_HOST + ':' + API_PORT;

var BLOCK_WAIT = 20000;


describe("initialize namereg contract", function() {
    it("Contract exists", function() {
        assert.notEqual(web3.eth.getCode(nameReg.address), '0x');
    });

    describe("web3 user registration", function() {
        var registerTxHash = '';

        before(function(done) {
            superagent.post(url_base + '/register')
                .send({address: web3.eth.coinbase, name: "ck", email: "ckeenan89@gmail.com", epk: "0123s09s091209123"})
                .end(function(err, res) {
                    if (err) throw err;
                    registerTxHash = res.body.data.txhash;
                    assert.equal(res.body.success, true);
                    setTimeout(done, BLOCK_WAIT);
                });
        });

        it("user name registered", function(done){
            superagent.get(url_base + '/profile/name/ck')
                .end(function(err, res) {
                    assert.equal(res.body.success, true);
                    done();
                });
            /*
            assert.equal(name, "Connor");
            assert.equal(addr, web3.eth.coinbase);
            */
        });

        it("user addr registered", function(done){
            superagent.get(url_base + '/profile/address/'+web3.eth.coinbase)
                .end(function(err, res) {
                    assert.equal(res.body.success, true);
                    done();
                });
            /*
            assert.equal(bytes, "{test: true}");
            */
        });

        describe("tx hash save and lookup", function() {
            before(function(done) {
                var eventWatch = childProcess.exec('node eventWatch.js', 
                        { evn: process.env },
                        function(err, stdout, stderr) {
                            assert.equal(err, null);
                            if (err) throw err;
                        });
                eventWatch.on('exit', function(code) {
                    done();
                });
            });

            it("check log for tx hash", function(done) {
                superagent.get(url_base + '/log/' + registerTxHash)
                    .end(function(err, res) {
                        assert.equal(res.body.success, true);
                        done();
                    });
            });
        });
    });
});
