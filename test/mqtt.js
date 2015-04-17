var auth = require('./auth');
var tokenForUser = auth.tokenForUser;
var mqtt = require('mqtt');
var thirdbaseroot = 'mqtt://localhost:1883';
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
            clearTimeout(timeout);
            resolve(client); //Success
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
exports.postMessagesToTopic = postMessagesToTopic;
