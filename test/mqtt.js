var auth = require('./auth');
var tokenForUser = auth.tokenForUser;
var mqtt = require('mqtt');
var thirdbaseroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls['3rd-base'];
function connectMqtt(userid, token) {
    return new Promise(function(resolve, reject) {
        var client  = mqtt.connect(thirdbaseroot, {
            protocolId: 'MQIsdp',
            protocolVersion: 3,
            username: userid,
            password: token,
            will: {
                topic: ['online', userid].join('/'),
                payload: JSON.stringify({
                    status: 'offline'
                }),
                qos: 2
            }
        });
        var timeout = setTimeout(function() {
            reject(); //Fail on time out
        }, 4000); //4s timeout
        client.on('connect', function () {
            var json = JSON.stringify({
                status: 'online'
            });
            client.publish('online/'+userid, json, {
                retain:true
            }, function() {
                resolve(client);
                clearTimeout(timeout);
            });
        });
    });
}
exports.connectMqtt = connectMqtt;

function connectTwoClients(user1,user2) {
    var loginToken1 = tokenForUser(user1);
    var loginToken2 = tokenForUser(user2);
    var connect1 = connectMqtt(user1,loginToken1);
    var connect2 = connectMqtt(user2,loginToken2);
    return Promise.all([connect1,connect2]);
}
exports.connectTwoClients = connectTwoClients;

function connectNClients(n) {
    var promises = [];
 for(var z = 0;  z < 4; z++) {
    for(var i = 0; i < n; i++) {
        var user = 'user'+i;
        var token = tokenForUser(user);
        var connect = connectMqtt(user, token);
        promises.push(connect);
    }
}
    return Promise.all(promises);
}
exports.connectNClients = connectNClients;

function postMessagesRatio(topic, clients, numofmsg, text, ratio) {
   ratio = ratio || 1;
   return new Promise(function(resolve) {
            clients.forEach(function(client) {
               client.subscribe(topic);
            });
            var recieved = 0;
            clients.forEach(function(client) {
                client.on('message', function(t,msg) {
                    if(t === topic) {
                        recieved += 1;
                        console.log(recieved/numofmsg);
                        if(recieved/numofmsg >= ratio) {
                           resolve();
                        }
                    }
                });
            });
            var msgperclient = Math.ceil(numofmsg/clients.length);
            for(var i = 0; i < msgperclient; i++) {
                clients.forEach(function(client) {
                    var message = {
                        body: String(new Date().getTime())
                    };
                    var payload = JSON.stringify(message);
                    client.publish(topic,payload);
                });
            }
        });
}
exports.postMessagesRatio = postMessagesRatio;
function postMessagesToTopic(topic, clients, numofmsg, text, ratio) {
   ratio = ratio || 1;
   return new Promise(function(resolve) {
           clients.forEach(function(client) {
               client.subscribe(topic);
           });
            var recieved = 0;
            clients[0].on('message', function(t,msg) {
                if(t === topic) {
                    recieved += 1;
                    if(recieved/numofmsg >= ratio) {
                       resolve();
                    }
                }
            });
            var message = {
                body: text
            };
            var payload = JSON.stringify(message);
            for(var i = 0; i < numofmsg; i++) {
                clients[1].publish(topic, payload);
            }
        });
}
exports.postMessagesToTopic = postMessagesToTopic;
