var request = require('request');
var async = require('async');

exports.formatHex = function(hex, withX) {
    if (typeof(withX) === 'undefined')
        withX = false;

    if (!withX && hex.slice(0,2) == '0x')
            hex = hex.slice(2);
    else if (withX && hex.slice(0,2) != '0x')
        hex = '0x' + hex;

    return hex;
}

exports.pad = function(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

exports.ethrpc = function(ethRpcUrl, method, params, next) {
    // Force to array
    if (!params || params.constructor !== Array) params = Array(params);

    // Force hex params to '0x..'
    async.map(params, function(p, cb) {
        cb(null, p.length < 40 || p.slice(0,2) === '0x' ? p : '0x' + p);
    }, function(err, formattedParams) {

        var msg = {
            'jsonrpc': '2.0',
            'method': method,
            'params': formattedParams,
            'id': 1
        };

        request.post(ethRpcUrl, {form: JSON.stringify(msg)}, next);
    });
}
