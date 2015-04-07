var request = require('request-promise');
var mqtt = require('mqtt');
var homebaseroot = 'http://localhost:8088';
var thirdbaseroot = 'mqtt://localhost:1883';
var assert = require("assert");
var jwt = require('jsonwebtoken');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync(__dirname+'/../config.json'));

var userid = 'user1';
var loginToken = jwt.sign({id: userid}, config.secret);
function connectMqtt(userid, token) {
    return new Promise(function(resolve, reject) {
        var client  = mqtt.connect(thirdbaseroot, {
            protocolId: 'MQIsdp',
            protocolVersion: 3,
            username: userid,
            password: token
        });
        var timeout = setTimeout(function() {
            reject(); //Fail on time out
        }, 4000); //4s timeout
        client.on('connect', function () {
            clearTimeout(timeout);
            resolve(client); //Success
        });
    });
}

function httpHeadersForToken(token) {
    return function headers(url) {
        return {
            url: url,
            resolveWithFullResponse: true,
            headers: {
                'Authorization': 'Bearer '+token
            }
        };
    }
};
var httpHeaders = httpHeadersForToken(loginToken);

it('should connect to MQTT', function() {
    return connectMqtt(userid,loginToken)
    .then(function(client) {
        client.publish('online/'+userid, JSON.stringify({
            status: 'online'
        }));
    });
});

it('should fetch list of own user\'s threads', function () {
    var url = [homebaseroot,'users',userid, 'threads'].join('/');
    return request.get(httpHeaders(url)).then(function(response) {
        assert.equal(200, response.statusCode); //will throw if unequal
        return JSON.parse(response.body);
    })
    .then(function(body){
        assert(body.rows) // chech that returned body has rows.
    });
});
