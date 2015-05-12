var assert = require('assert');
var mqtt = require('./mqtt');
var time = require('./time');
var connectTwoClients = mqtt.connectTwoClients;
var connectMqtt = mqtt.connectMqtt;
var auth = require('./auth');
var tokenForUser = auth.tokenForUser;
var userid1 = 'user1';
var userid2 = 'user2';
var delay = time.delay;

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);

describe('mqtt.online', function() {
    it('should connect to MQTT', function() {
        return connectMqtt(userid1, loginToken1);
    });

    it('should connect to MQTT with user 2', function() {
        return connectMqtt(userid2, loginToken2)
        .then(function(client) {
            client.publish('online/'+userid2, JSON.stringify({
                status: 'online'
            }));
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
                c1.subscribe('online/user1');
            });
        });
    });
    it('should log out users', function() {
        this.timeout(4000);
        return connectTwoClients('ida','pelle')
        .then(function(clients) {
            return new Promise(function(resolve) {
                var ida = clients[0];
                var pelle = clients[1];
                pelle.on('message', function(topic, message) {
                    var data = JSON.parse(message.toString());
                    if(data.status == 'offline') {
                        resolve(data);
                    }
                });
                var json = JSON.stringify({
                    status: 'offline'
                });
                pelle.subscribe('online/ida', function() {
                    ida.publish('online/ida', json);
                });
            });
        });
    });
    it('should log out users if connection lost even if forcefully closed', function() {
        return connectTwoClients('ida','pelle')
        .then(function(clients) {
            return new Promise(function(resolve) {
                var ida = clients[0];
                var pelle = clients[1];
                pelle.on('message', function(topic, message) {
                    var data = JSON.parse(message.toString());
                    if(data.status == 'offline') {
                        resolve(data);
                    }
                });
                pelle.subscribe('online/ida', function() {
                    //Forcefully kill ida
                    ida.stream.end();
                });
            });
        });
    });

    it('should not log out if user has a connected client', function() {
        return connectTwoClients('ida','ida')
        .then(function(clients) {
            return new Promise(function(resolve,reject) {
                var ida = clients[0];
                var ida2 = clients[1];
                ida2.on('message', function(topic, message) {
                    var data = JSON.parse(message.toString());
                    if(data.status === 'offline') {
                        reject(new Error('User was logged out with connected client'));
                    }
                });
                setTimeout(function() {
                    //If no message has arrived in time accept this.
                    resolve();
                }, 100);
                ida2.subscribe('online/ida');
                ida.publish('online/ida', JSON.stringify({
                   status:'offline'
                }));
            });
        });
    });

    it('should not log out if user has a connected client even if forcefully terminated', function() {
        return connectTwoClients('ida','ida')
        .then(function(clients) {
            return new Promise(function(resolve,reject) {
                var ida = clients[0];
                var ida2 = clients[1];
                ida2.on('message', function(topic, message) {
                    var data = JSON.parse(message.toString());
                    if(data.status === 'offline') {
                        reject(new Error('User was logged out with connected client'));
                    }
                });
                setTimeout(function() {
                    //If no message has arrived in time accept this.
                    resolve();
                }, 100);
                ida2.subscribe('online/ida');
                //Forcefully kill one ida client
                ida.stream.end();
            });
        });
    });

    it('should not publish online two times if the same user connects as two clients', function() {
         return connectTwoClients('user1', 'user1')
        .then(function(clients) {
            return new Promise(function(resolve) {
                var c1 = clients[0];
                var c2 = clients[1];
                var topic = 'online/user1';
                var i = 0;
                c2.on('message', function(topic, message){
                    i += 1;
                });
                c2.subscribe('online/user1');
                c1.subscribe('online/user1');
                setTimeout(function() {
                    if(i == 1) {
                        resolve();
                    }
                }, 1000);
            });
        });
    });
});

