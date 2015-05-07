var assert = require('assert');
var request = require('request-promise');
var http = require('./http');
var auth = require('./auth');
var mqtt = require('./mqtt');
var time = require('./time');
var connectTwoClients = mqtt.connectTwoClients;
var tokenForUser = auth.tokenForUser;
var httpHeadersForToken = http.httpHeadersForToken;
var postHeaders = http.postHeaders;
var createThread = http.createThread;
var cleanDatabase = http.cleanDatabase;
var delay = time.delay;

var homebaseroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls.homebase;
var userid1 = 'user1';
var userid2 = 'user2';

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);
var httpHeaders1 = httpHeadersForToken(loginToken1);
var httpHeaders2 = httpHeadersForToken(loginToken2);


describe('mqtt.members', function() {
    it('should tell if user are invited to new private chat in MQTT topic users/own ID/newthreads', function() {
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

    it('should tell if user are invited to new group in MQTT topic users/own ID/newthreads', function() {
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
                        //console.log(msg.toString('utf8'));
                        resolve();
                    }
                })
                createThread(['user1','user2', 'user3'], 'user2');
            })
        })
    });

    it('should tell if new users are invited to group chat under threads/thread ID/members', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2', 'user3'], 'user1');
        })
        .then(function(httpResponse) {
            location = httpResponse.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var threadId = location.split('/')[2];
            var topic = 'threads/' + threadId + '/members';
            clients[0].subscribe(topic);
            return new Promise(function(resolve) {
                clients[0].on('message', function(t,msg) {
                  if(t === topic) {
                      resolve();
                  }
                })
                var url = homebaseroot + location + '/users';
                request.post(postHeaders(url, {"users": ['user4']}, httpHeaders1));
             });
        });
    });

    it('should fail to add user to private chat', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2'], 'user1');
        })
        .then(function(httpResponse) {
            location = httpResponse.headers.location;
            var url = homebaseroot + location + '/users';
            return request.post(postHeaders(url, {"users": ['user4']}, httpHeaders1))
            .catch(function(error) {
                assert.equal(400, error.statusCode);
            });
        })
    });

    it('should tell if a users are removed from group chat under threads/thread ID/members', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2', 'user3', 'user4'], 'user1');
        })
        .then(function(httpResponse) {
            location = httpResponse.headers.location;
            return connectTwoClients('user1', 'user2');
        })
        .then(function(clients) {
            var threadId = location.split('/')[2];
            var topic = 'threads/' + threadId + '/members';
            clients[0].subscribe(topic);
            return new Promise(function(resolve) {
                clients[0].on('message', function(t,msg) {
                  if(t === topic) {
                      resolve();
                  }
                })
                var url = homebaseroot + location + '/users/me';
                request.del(httpHeaders1(url));
            });
        });
     });
});
