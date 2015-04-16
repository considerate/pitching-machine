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

function cleanDatabase() {
    var couchroot = 'http://localhost:5984/baseball';
    return request.get([couchroot,'_all_docs?startkey="_design/"&endkey="_design0"'].join('/'))
    .then(function(designdocstext) {
        var designdocs = JSON.parse(designdocstext).rows.map(function(doc) {
           return doc.id;
        });
        return request.get([couchroot,'_all_docs'].join('/'))
        .then(function(alldocstext) {
            var alldocs = JSON.parse(alldocstext).rows;
            var toRemove = alldocs.filter(function(doc){
                var index = designdocs.indexOf(doc.id);
                return index === -1;
            }).map(function (doc) {
                doc.value._deleted = true;
                doc.value._id = doc.id;
                doc.value._rev = doc.value.rev;
                return doc.value;
            });
            var bulk = {
                docs: toRemove
            };
            return request.post({
                url: [couchroot,'_bulk_docs'].join('/'),
                body: JSON.stringify(bulk),
                headers: {
                   'Content-Type': 'application/json'
                }
            }).then(function(body) {
                return request.get([couchroot,'_all_docs'].join('/'))
                .then(function(body) {
                    var data = JSON.parse(body);
                    assert.equal(designdocs.length, data.rows.length);
                });
            });
        });
    });
}

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

function createThread(users, creator) {
    var url = [homebaseroot, 'threads'].join('/');
   return  request.post(postHeaders(url,
            {"users": users},
            httpHeadersForToken(tokenForUser(creator))
            )
    );
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
        });
    });
});

it('should tell user online status', function() {
    return connectTwoClients('user1', 'user2')
    .then(function(clients) {
        return new Promise(function(resolve) {
            var c1 = clients[0];
            var c2 = clients[1];
            c2.on('message', function(message){
                resolve();
            });
            var message = JSON.stringify({
                status: 'online'
            });
            c2.subscribe('online/user1');
            c1.publish('online/user1', message, {
                    retain: 1,
                    qos: 2
            }, function(err,result) {
            });
            c1.subscribe('online/user1');

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

it('should add self to thread even if not given in array', function () {
    return cleanDatabase()
    .then(function() {
        var url = [homebaseroot, 'threads'].join('/');
        return request.post(postHeaders(url,{
            "users": ['user1', 'user2']
        },httpHeaders1));
    })
    .then(function () {
        var url = [homebaseroot, 'threads'].join('/');
        return request.post(postHeaders(url,{
            "users": ['user3', 'user4']
        }, httpHeaders1))
    })
    .then(function() {
        var url = [homebaseroot, 'users', userid1, 'threads'].join('/');
        return request.get(httpHeaders1(url));
    })
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
        }, httpHeaders1));
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

it('should store sent message in database', function() {
    var url = [homebaseroot, 'threads'].join('/');
    this.timeout(10000);
    return cleanDatabase()
    .then(function() {
        return request.post(postHeaders(url, {
            "users": ['user1', 'user2']
        }, httpHeaders1));
    })
    .then(function(response) {
        var location = response.headers.location.split('/');
        return location;
    })
    .then(function(location) {
        return connectTwoClients('user1','user2')
        .then(function(clients) {
            return {
                location: location,
                clients: clients
            };
        })
    })
    .then(function(result) {
        var clients = result.clients;
        var location = result.location;
        var c1 = clients[0];
        var c2 = clients[1];
        var topic = ['threads',location[2],'messages'].join('/');
        return new Promise(function(resolve) {
            c1.on('message', function(t,msg) {
                if(t === topic) {
                    resolve();
                }
            })
            c1.subscribe(topic);
            c2.subscribe(topic);
            var message = {
                body: 'Hej på dig!'
            };
            var payload = JSON.stringify(message);
            c1.publish(topic, payload);
        })
        .then(function() {
            var messageUrl = homebaseroot + location.join('/') + '/messages';
            return messageUrl;
        });
    })
    .then(function(messageUrl) {
        return request.get(httpHeaders1(messageUrl));
    })
    .then(function(messagesresponse) {
        var body = JSON.parse(messagesresponse.body);
        var thisMsg = body.messages.filter(function(message) {
            return message.body === 'Hej på dig!';
        });
        assert(thisMsg.length > 0);
    });
});

it('should return beforelink if max messages fetched and no before or after specified', function() {
    var url = [homebaseroot, 'threads'].join('/');
    this.timeout(10000);
    return cleanDatabase()
    .then(function() {
        return request.post(postHeaders(url, {
            "users": ['user1', 'user2']
        }, httpHeaders1));
    })
    .then(function(response) {
        var location = response.headers.location.split('/');
        return location;
    })
    .then(function(location) {
        return connectTwoClients('user1','user2')
        .then(function(clients) {
            return {
                location: location,
                clients: clients
            };
        })
    })
    .then(function(result) {
        var clients = result.clients;
        var location = result.location;
        var c1 = clients[0];
        var c2 = clients[1];
        var topic = ['threads',location[2],'messages'].join('/');
        return new Promise(function(resolve) {
            var waitingfor = 21;
            c1.on('message', function(t,msg) {
                if(t === topic) {
                    if(waitingfor > 1) {
                        waitingfor -= 1;
                    } else {
                        resolve();
                    }
                }
            })
            c1.subscribe(topic);
            c2.subscribe(topic);
            var message = {
                body: 'Hej på dig!'
            };
            var payload = JSON.stringify(message);
            for(var i = 0; i < 21; i++) {
                c1.publish(topic, payload);
            }
        })
        .then(function() {
            var messageUrl = homebaseroot + location.join('/') + '/messages';
            return messageUrl;
        });
    })
    .then(function(messageUrl) {
        return request.get(httpHeaders1(messageUrl));
    })
    .then(function(messagesresponse) {
        var body = JSON.parse(messagesresponse.body);
        var thisMsg = body.messages.filter(function(message) {
            return message.body === 'Hej på dig!';
        });
        assert(thisMsg.length > 0);
        assert(body.links.before);
    });
});

it('should return same thread id for a private chatt created with same users', function() {
   return cleanDatabase()
   .then(function(){
       return createThread(['user1','user2'], 'user1')
       .then(function(response) {
            return createThread(['user2','user1'], 'user2')
            .then(function(responseTwo) {
                assert.equal(response.headers.location,
                           responseTwo.headers.location);
            })
       })
   })
});

it('should be able to get messages from before link', function() {
    return cleanDatabase()
    .then(function() {
        return createThread(['user1','user2'], 'user1');
    })
    .then(function(response) {
        return connectTwoClients('user1','user2')
        .then(function(clients) {
            return {
                location: response.headers.location,
                clients: clients
            };
        })
    })
    .then(function(result) {
        var location = result.location.split('/');
        var topic = ['threads',location[2],'messages'].join('/');
        return postMessagesToTopic(topic, result.clients, 21, 'Hej på dig!')
        .then(function() {
            return result.location;
        })
    })
    .then(function(resp) {
        var msgUrl = homebaseroot + resp + '/messages';
        return request.get(httpHeaders1(msgUrl));
    })
    .then(function(messagesresponse) {
        var body = JSON.parse(messagesresponse.body);
        var msgUrl = homebaseroot + body.links.before;
        return request.get(httpHeaders1(msgUrl));
    })
    .then(function(msgresponse) {
        var body = JSON.parse(msgresponse.body);
        var thisMsg = body.messages.filter(function(message) {
            return message.body === 'Hej på dig!';
        });
        assert(thisMsg.length > 0);
    })
});

function postMessagesToTopic(topic, clients, numofmsg, text) {
   return new Promise(function(resolve) {
           clients.forEach(function(client) {
               client.subscribe(topic);
           });
            var waitingfor = numofmsg;
            clients[0].on('message', function(t,msg) {
                if(t === topic) {
                    if(waitingfor > 1) {
                        waitingfor -= 1;
                    } else {
                        resolve();
                    }
                }
            })
            var message = {
                body: text
            };
            var payload = JSON.stringify(message);
            for(var i = 0; i < numofmsg; i++) {
                clients[0].publish(topic, payload);
            }
        });
}

it('should be able to fetch new message history with after link', function() {
    var threadLocation;
    var msgId;
    var clients;
    var topic;
    return cleanDatabase()
    .then(function() {
        return createThread(['user1','user2'], 'user1');
    })
    .then(function(response) {
        threadlocation = response.headers.location;
        return connectTwoClients('user1', 'user2');
    })
    .then(function(connectedClients) {
        clients = connectedClients;
        var topicLocation = threadlocation.split('/');
        topic = ['threads',topicLocation[2],'messages'].join('/');
        return postMessagesToTopic(topic, clients, 2, 'Hej!');
    })
    .then(function() {
        var url = homebaseroot + threadlocation + '/messages'; 
        return request.get(httpHeaders2(url));
    })
    .then(function(requestResponse) {
        msgId = JSON.parse(requestResponse.body).messages[1].id;
        return postMessagesToTopic(topic, clients, 3, 'Hallå!');
    })
    .then(function() {
        var url = homebaseroot + threadlocation + '/messages' + '?after=' + msgId;
        return request.get(httpHeaders2(url));
    })
    .then(function(reqResponse) {
        var messages = JSON.parse(reqResponse.body).messages;
        var thisMsg = messages.filter(function(message) {
            return message.body === 'Hallå!';
        });
        assert.equal(3, messages.length);
    });
});

it.only('should tell if user are invited to new threads in MQTT topic users/own ID/newthreads', function() {
    this.timeout(5000);
    return cleanDatabase()
    .then(function() {
        return connectTwoClients('user1', 'user2');
    })
    .then(function(clients) {
        var topic = 'users/user1/newthreads';
        clients[0].subscribe(topic);
        return new Promise(function(resolve) {
            clients[0].on('message', function(t,msg) {
                if(t === topic) {
                    resolve();
                }
            })
            createThread(['user1','user2'], 'user2');
        })
    })
});
