var mqtt = require('./mqtt');
var connectTwoClients = mqtt.connectTwoClients;
var postMessagesToTopic = mqtt.postMessagesToTopic;

describe('mqtt.messages', function() {
    it('should recieve message', function(){
        return connectTwoClients('user1', 'user2')
        .then(function(clients) {
            return postMessagesToTopic('chat', clients, 1, 'Hej!');
        });
    });
});
