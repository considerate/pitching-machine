var assert = require('assert');
var mqtt = require('./mqtt');
var connectTwoClients = mqtt.connectTwoClients;
var connectMqtt = mqtt.connectMqtt;
var auth = require('./auth');
var tokenForUser = auth.tokenForUser;
var userid1 = 'user1';
var userid2 = 'user2';

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);

describe('mqtt.online', function() {
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
                c1.publish('online/user1', message, {
                    retain: 1,
                    qos: 2
                }, function(err,result) {
                });
                c1.subscribe('online/user1');

            });
        });
    });
    it('should log out users if connection lost', function() {
        this.timeout(1000*60);
        return connectTwoClients('ida','pelle')
        .then(function(clients) {
            return new Promise(function(resolve) {
                var ida = clients[0];
                var pelle = clients[1];
                pelle.on('message', function(topic, message) {
                    var data = JSON.parse(message.toString());
                    resolve(data);
                });
                pelle.subscribe('online/ida');
                //Forcefully kill ida
                ida.stream.end();
            });
        })
        .then(function(data) {
            assert.equal('offline', data.status);
        });
    });
});
