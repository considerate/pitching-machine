var mqtt = require('./mqtt');
var connectTwoClients = mqtt.connectTwoClients;
describe('mqtt.messages', function() {
    it('should recieve message', function(){
        return connectTwoClients('user1', 'user2')
        .then(function(clients) {
            return new Promise(function(resolve) {
                var c1 = clients[0];
                var c2 = clients[1];
                c2.on('message', function(topic, message) {
                    resolve();
                });
                c1.subscribe('threads/hej');
                c2.subscribe('threads/hej');
                c1.publish('threads/hej', 'hejsan');
            });
        });
    });
});
