var request = require('request-promise');
var assert = require("assert");

var http = require('./http');
var auth = require('./auth');
var mqtt = require('./mqtt');
var tokenForUser = auth.tokenForUser;
var httpHeadersForToken = http.httpHeadersForToken;
var postHeaders = http.postHeaders;
var createThread = http.createThread;
var cleanDatabase = http.cleanDatabase;
var connectTwoClients = mqtt.connectTwoClients;
var postMessagesToTopic = mqtt.postMessagesToTopic;

var homebaseroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls.homebase;
var userid1 = 'user1';
var userid2 = 'user2';

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);
var httpHeaders1 = httpHeadersForToken(loginToken1);
var httpHeaders2 = httpHeadersForToken(loginToken2);

describe('http.threads.messages', function () {
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

    it('should store image field in message', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return createThread(['user1', 'user2', 'user3'], 'user3');
        })
        .then(function(response) {
            location = response.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var topic = 'threads/' + location.split('/')[2] + '/messages';
            var body = {image: 'http://www.hejsan.se'};
            var payload = JSON.stringify(body);
            clients[0].publish(topic, payload);
            var url = homebaseroot + location + '/messages';
            return request.get(httpHeaders1(url));
        })
        .then(function(httpResponse) {
            var body = JSON.parse(httpResponse.body);
            assert(undefined !== body.messages[0].image);
        })
    })
});
