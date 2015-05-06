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

var homebaseroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls.homebase;
var userid1 = 'user1';
var userid2 = 'user2';

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);
var httpHeaders1 = httpHeadersForToken(loginToken1);
var httpHeaders2 = httpHeadersForToken(loginToken2);


describe.only('mqtt.public', function() {
    it('should be able to connect to a public room, rooms/room ID, and send a message', function() {
        var topic = 'rooms/park1';
        return connectTwoClients('user1', 'user2')
        .then(function(clients) {
            clients[0].subscribe(topic);
            clients[1].subscribe(topic);
            return new Promise(function(resolve) {
                clients[0].on('message', function(topic, msg) {
                    var message = JSON.parse(msg.toString());
                    if(message.body !== undefined && message.from !== undefined) {
                        resolve();
                    }
                })
                var body = {
                    body: 'Hej!'
                };
                var payload = JSON.stringify(body);
                clients[1].publish(topic, payload);
            });
        });
    });
});
