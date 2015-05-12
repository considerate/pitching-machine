var assert = require('assert');
var request = require('request-promise');
var http = require('./http');
var auth = require('./auth');
var mqtt = require('./mqtt');
var time = require('./time');
var connectTwoClients = mqtt.connectTwoClients;
var connectNClients = mqtt.connectNClients;
var tokenForUser = auth.tokenForUser;
var httpHeadersForToken = http.httpHeadersForToken;
var postHeaders = http.postHeaders;
var createThread = http.createThread;
var cleanDatabase = http.cleanDatabase;
var postMessagesToTopic = mqtt.postMessagesToTopic;
var postMessagesRatio = mqtt.postMessagesRatio;
var delay = time.delay;

var homebaseroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls.homebase;
var userid1 = 'user1';
var userid2 = 'user2';

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);
var httpHeaders1 = httpHeadersForToken(loginToken1);
var httpHeaders2 = httpHeadersForToken(loginToken2);

describe('mqtt.messages', function() {
    it('Should send a text message in private chat through MQTT properly', function(){
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2'], 'user1');
        })
        .then(function(response) {
            location = response.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var topic = 'threads/' + location.split('/')[2] + '/messages';
            return new Promise(function(resolve) {
                clients[0].on('message', function(t,msg) {
                    if(t === topic) {
                        var parsedMsg = JSON.parse(msg.toString('utf8'));
                        if(parsedMsg.from !== undefined && parsedMsg.body !== undefined) {
                            resolve();
                        } else {
                            throw new Error("Incorrect message format");
                        }
                    }
                })
                var message = {body: 'hej' };
                var payload = JSON.stringify(message);
                clients[0].subscribe(topic, function() {
                    clients[1].publish(topic, payload);
                });
            });
        });
    });

    it('Should send a text message in group chat through MQTT properly', function(){
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2', 'user3'], 'user1');
        })
        .then(function(response) {
            location = response.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var topic = 'threads/' + location.split('/')[2] + '/messages';
            return new Promise(function(resolve) {
                clients[0].on('message', function(t,msg) {
                    if(t === topic) {
                        var parsedMsg = JSON.parse(msg.toString('utf8'));
                        if(parsedMsg.from !== undefined && parsedMsg.body !== undefined) {
                            resolve();
                        } else {
                            throw new Error("Incorrect message format");
                        }
                    }
                })
                var message = {body: 'hej' };
                var payload = JSON.stringify(message);
                clients[0].subscribe(topic, function() {
                    clients[1].publish(topic, payload);
                });
            });
        });
    });

    it('Should send a image message in chat through MQTT properly', function(){
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2', 'user3'], 'user1');
        })
        .then(function(response) {
            location = response.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var topic = 'threads/' + location.split('/')[2] + '/messages';
            return new Promise(function(resolve) {
                clients[0].on('message', function(t,msg) {
                    if(t === topic) {
                        var parsedMsg = JSON.parse(msg.toString('utf8'));
                        if(parsedMsg.from !== undefined && parsedMsg.image !== undefined) {
                            resolve();
                        } else {
                            throw new Error("Incorrect message format");
                        }
                    }
                })
                var message = {image: 'hej' };
                var payload = JSON.stringify(message);
                clients[0].subscribe(topic, function() {
                    clients[1].publish(topic, payload);
                });
            });
        });
    });

    it.skip('should test if 95% of the messages gets through MQTT', function() {
        this.timeout(0);
        var location;
        return createThread(['user1', 'user2'], 'user3')
        .then(function(response) {
            location = response.headers.location;
            return connectNClients(1024);
        })
        .then(function(clients) {
           var topic = 'threads/' + location.split('/')[2] + '/messages';
           return postMessagesRatio(topic, clients, 2*4096, 'hej', 0.95)
           .then(function() {
               return delay(1000);
           });
        });
    });
});
