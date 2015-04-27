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


describe('mqtt.members', function() {
    it('should tell if user are invited to new threads in MQTT topic users/own ID/newthreads', function() {
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
});
