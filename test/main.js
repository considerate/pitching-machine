var request = require('request-promise');
var mqtt = require('mqtt');
var homebaseroot = 'http://localhost:8088';
var thirdbaseroot = 'mqtt://localhost:1883';
var assert = require("assert");
var jwt = require('jsonwebtoken');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync(__dirname+'/../config.json'));

expDate.setDate(expDate.getDate() + 14); //14 days into future
var userid1 = 'user1';
var userid2 = 'user2';
var expDate = new Date();
var loginToken1 = jwt.sign({id: userid1 ,exp: expDate.getTime()}, config.secret);
var loginToken2 = jwt.sign({id: userid2 ,exp: expDate.getTime()}, config.secret);
var httpHeaders1 = httpHeadersForToken(loginToken1);
var httpHeaders2 = httpHeadersForToken(loginToken2);
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
                'Authorization': 'Bearer '+token,
                'Content-Type': 'application/json'
            }
        };
    }
};

function postHeaders(url, body, httpHeaders) {
    var options = httpHeaders(url);
    if(typeof body === 'object') {
        body = JSON.stringify(body);
    }
    options.body = body;
    return options;
}

it('should connect to MQTT', function() {
    return connectMqtt(userid1, loginToken1)
    .then(function(client) {
        client.publish('online/'+userid1, JSON.stringify({
            status: 'online'
        }));
    });
});

it('should recieve message', function(){
    var user1 = 'user_A',
        user2 = 'user_B',
        loginToken1 = jwt.sign({id: userid,exp: expDate.getTime()}, config.secret),
        loginToken2 = jwt.sign({id: userid,exp: expDate.getTime()}, config.secret),
        con1 = connectMqtt(user1, loginToken1),
        con2 = connectMqtt(user2, loginToken2),
        url = [homebaseroot,'threads'].join('/'),
        thread = request.post(postHeaders(url,{"users": ['user_A', 'user_B']}));

    return(user1 != user2);

    //TODO
    //1. user1 sends msg to user2
    //2. check if user2 recieved msg
})


it('should fetch list of own user\'s threads', function () {
    var url = [homebaseroot, 'users', userid1, 'threads'].join('/');
    return request.get(httpHeaders1(url))
    .then(function(response) {
        assert.equal(200, response.statusCode); //will throw if unequal
        return JSON.parse(response.body);
    })
    .then(function(body){
        assert(body.rows) // check that returned body has rows.
    });
});

it('should create new thread', function() {
  var url = [homebaseroot,'threads'].join('/');
  return request.post(postHeaders(url,{
    "users": ['user1', 'user2']
  }, httpHeaders1))
  .then(function(response) {
    assert.equal(201, response.statusCode);
    var location = response.headers.location;
    var locationUrl = homebaseroot + location;
    return request.get(httpHeaders1(locationUrl))
    .then(function(response) {
      assert.equal(200, response.statusCode);
    })
  })
});

it('should create another new thread', function() {
  var url = [homebaseroot,'threads'].join('/');
  return request.post(postHeaders(url,{
    "users": ['user3', 'user4']
  }, httpHeaders1))
  .then(function(response) {
    assert.equal(201, response.statusCode);
    var location = response.headers.location;
    var locationUrl = homebaseroot + location;
    return request.get(httpHeaders1(locationUrl))
    .then(function(response) {
      assert.equal(200, response.statusCode);
    })
  })
});

it('should reply that user 1 has two threads', function () {
    var url = [homebaseroot, 'users', userid1, 'threads'].join('/');
    return request.get(httpHeaders1(url))
    .then(function(response) {
        assert.equal(200, response.statusCode); //will throw if unequal
        return JSON.parse(response.body);
    })
    .then(function(body){
        assert.equal(2, body.rows.length) // There should now be two threads 
    });
});

it('should connect to MQTT with user 2', function() {
    return connectMqtt(userid2, loginToken2)
    .then(function(client) {
        client.publish('online/'+userid2, JSON.stringify({
            status: 'online'
        }));
    });
});

it('should create new thread with user 2', function() {
  var url = [homebaseroot,'threads'].join('/');
  return request.post(postHeaders(url,{
    "users": ['user3', 'user4']
  }, httpHeaders2))
  .then(function(response) {
    assert.equal(201, response.statusCode);
    var location = response.headers.location;
    var locationUrl = homebaseroot + location;
    return request.get(httpHeaders2(locationUrl))
    .then(function(response) {
      assert.equal(200, response.statusCode);
    })
  })
});

it('should reply that user 2 has two threads', function () {
    var url = [homebaseroot, 'users', userid2, 'threads'].join('/');
    return request.get(httpHeaders2(url))
    .then(function(response) {
        assert.equal(200, response.statusCode); //will throw if unequal
        return JSON.parse(response.body);
    })
    .then(function(body){
        assert.equal(2, body.rows.length) // There should now be two threads 
    });
});


