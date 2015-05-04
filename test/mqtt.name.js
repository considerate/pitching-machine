var assert = require('assert');
var request = require('request-promise');
var http = require('./http');
var auth = require('./auth');
var mqtt = require('./mqtt');
var connectTwoClients = mqtt.connectTwoClients;
var tokenForUser = auth.tokenForUser;
var httpHeadersForToken = http.httpHeadersForToken;
var postHeaders = http.postHeaders;
var createThread = http.createThread;
var cleanDatabase = http.cleanDatabase;

var homebaseroot = 'http://localhost:8088';
var userid1 = 'user1';
var userid2 = 'user2';

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);
var httpHeaders1 = httpHeadersForToken(loginToken1);
var httpHeaders2 = httpHeadersForToken(loginToken2);


describe('mqtt.name', function() {
    it('should notify if the group name is changed in MQTT, threads/thread ID/messages', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return request.post(postHeaders(url, {
                    "users": ['user1', 'user2', 'user3']
                }, httpHeaders1)
            );
        })
        .then(function(httpResponse) {
            location = httpResponse.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var topic = 'threads/' + location.split('/')[2] + '/name';
            clients[0].subscribe(topic);
            return new Promise(function(resolve) {
                clients[0].on('message', function(t, msg) {
                    if(t === topic) {
                        resolve();
                    }
                });
                var url = homebaseroot + location + '/name';
                request.put(postHeaders(url, {"name": "sweet"}, httpHeaders1))
            });
        });
    });

    it('should notify if the group name is removed in MQTT, threads/thread ID/messages', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return request.post(postHeaders(url, {
                    "users": ['user1', 'user2', 'user3'],
                    "name": "sweet"
                }, httpHeaders1)
            );
        })
        .then(function(httpResponse) {
            location = httpResponse.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var topic = 'threads/' + location.split('/')[2] + '/name';
            clients[0].subscribe(topic);
            return new Promise(function(resolve) {
                clients[0].on('message', function(t, msg) {
                    if(t === topic) {
                        resolve();
                    }
                });
                var url = homebaseroot + location + '/name';
                request.del(httpHeaders1(url));
            });
        });
    });

});