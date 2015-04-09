var request = require('request-promise');
var mqtt = require('mqtt');
var homebaseroot = 'http://localhost:8088';
var thirdbaseroot = 'mqtt://localhost:1883';
var assert = require("assert");
var jwt = require('jsonwebtoken');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync(__dirname+'/../config.json'));

var userid1 = 'user1';
var userid2 = 'user2';

function tokenForUser(userid) {
    var expDate = new Date();
    expDate.setDate(expDate.getDate() + 14); //14 days into future
    return jwt.sign({id: userid ,exp: expDate.getTime()}, config.secret);
}

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);
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
    options.followAllRedirects = true;
    options.body = body;
    return options;
}

it('should connect to MQTT', function() {
    return connectMqtt(userid1, loginToken1)
    .then(function(client) {
        var json = JSON.stringify({
            status: 'online'
        });
        client.publish('online/'+userid1, {
            message: json,
            options: {
                retain: 1
            }
        });
    });
});
function connectTwoClients(user1,user2) {
    var loginToken1 = tokenForUser(user1);
    var loginToken2 = tokenForUser(user2);
    var connect1 = connectMqtt(user1,loginToken1);
    var connect2 = connectMqtt(user2,loginToken2);
    return Promise.all([connect1,connect2]);
}

it('should recieve message', function(){
    return connectTwoClients('user1', 'user2')
    .then(function(clients) {
        return new Promise(function(resolve) {
            var c1 = clients[0];
            var c2 = clients[1];
            c2.on('message', function(topic, message) {
                resolve();
            });
            c1.subscribe('threads/hej');
            c2.subscribe('threads/hej');
            c1.publish('threads/hej', 'hejsan');
        })

    })

});




it('should tell user online status', function() {
    return connectTwoClients('user1', 'user2')
    .then(function(clients) {
        return new Promise(function(resolve) {
            var c1 = clients[0];
            var c2 = clients[1];
            c1.publish('online/user1', {
                message: json,
                options: {
                    retain: 1
                }
            });

            c2.subscribe('online/user1');
            c2.on('message', function(message){
                console.log(message);
                resolve();
            });
        });
    })
});


it('should fetch list of own user\'s threads', function () {
    var url = [homebaseroot, 'users', userid1, 'threads'].join('/');
    return request.get(httpHeaders1(url))
    .then(function(response) {
        assert.equal(200, response.statusCode); //will throw if unequal
        return JSON.parse(response.body);
    })
    .then(function(body){
        assert(body.threads); // check that returned body has rows.
    });
});

it('should create new thread', function() {
    var url = [homebaseroot,'threads'].join('/');
    return request.post(postHeaders(url,{
        "users": ['user1', 'user2']
    },httpHeaders1))
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
        assert.equal(2, body.threads.length); // There should now be two threads 
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
        assert.equal(2, body.threads.length); // There should now be two threads 
    });
});



it('should add user to thread', function() {
    var url = [homebaseroot, 'threads'].join('/');
    return request.post(postHeaders(url, {
        "users": ['user1','user2','user3']
    },httpHeaders1))
    .then(function(response) {
        var location = response.headers.location;
        var addUserUrl = homebaseroot + location + '/users';
        return request.post(postHeaders(addUserUrl, {
            "users": ['user4']
        }, httpHeaders1))
    }).then(function(response) {
        var data = JSON.parse(response.body);
        var users = data.thread.users;
        var index = users.indexOf('user4');
        assert.notEqual(-1, index);
    })
});

it('should remove user from thread', function() {
    var url = [homebaseroot, 'threads'].join('/');
    return request.post(postHeaders(url, {
        "users": ['user1','user2']
    },httpHeaders1))
    .then(function(response) {
        var location = response.headers.location;
        var removeUserUrl = homebaseroot + location + '/users/' + 'user1';
        return request.del(httpHeaders1(removeUserUrl));
    })
    .then(function(response) {
        var data = JSON.parse(response.body);
        var users = data.users;
        var index = users.indexOf('user1');
        assert.equal(-1, index);
    });
});
