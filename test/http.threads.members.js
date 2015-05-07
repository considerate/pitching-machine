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


describe('http.threads.members', function() {
    it('should add user to group chat', function() {
        var url = [homebaseroot, 'threads'].join('/');
        return request.post(postHeaders(url, {
            "users": ['user1','user2','user3']
        },httpHeaders1))
        .then(function(response) {
            var location = response.headers.location;
            var addUserUrl = homebaseroot + location + '/users';
            return request.post(postHeaders(addUserUrl, {
                "users": ['user4']
            }, httpHeaders1));
        }).then(function(response) {
            var data = JSON.parse(response.body);
            var users = data.thread.users;
            var index = users.indexOf('user4');
            assert.notEqual(-1, index);
        })
    });

    it('should remove user from private chat', function() {
        var url = [homebaseroot, 'threads'].join('/');
        return request.post(postHeaders(url, {
            "users": ['user1','user2']
        },httpHeaders1))
        .then(function(response) {
            var location = response.headers.location;
            var removeUserUrl = homebaseroot + location + '/users/' + 'user1';
            return request.del(httpHeaders1(removeUserUrl));
        })
        .then(function(response) {
            var data = JSON.parse(response.body);
            var users = data.users;
            var index = users.indexOf('user1');
            assert.equal(-1, index);
        });
    });

    it('should add self to thread even if not given in array', function () {
        return cleanDatabase()
        .then(function() {
            var url = [homebaseroot, 'threads'].join('/');
            return request.post(postHeaders(url,{
                "users": ['user1', 'user2']
            },httpHeaders1));
        })
        .then(function () {
            var url = [homebaseroot, 'threads'].join('/');
            return request.post(postHeaders(url,{
                "users": ['user3', 'user4']
            }, httpHeaders1));
        })
        .then(function() {
            var url = [homebaseroot, 'users', userid1, 'threads'].join('/');
            return request.get(httpHeaders1(url));
        })
        .then(function(response) {
            assert.equal(200, response.statusCode); //will throw if unequal
            return JSON.parse(response.body);
        })
        .then(function(body){
            assert.equal(2, body.threads.length); // There should now be two threads
        });
    });

    it('Should not be able to remove other user but yourself from thread', function() {
       return cleanDatabase()
       .then(function() {
        var url = [homebaseroot, 'threads'].join('/');
        return createThread(['user1', 'user2', 'user3'], 'user1');
       })
       .then(function(response) {
            var location = response.headers.location;
            var removeUserUrl = homebaseroot + location + '/users/' + 'user1';
            return request.del(httpHeaders2(removeUserUrl))
            .catch(function(error) {
                assert.equal(403, error.statusCode);
            });
        });
    });

    it('should not list left threads in /users/me/threads', function() {
        var url = [homebaseroot, 'threads'].join('/');
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2'], 'user1');
        })
        .then(function(response) {
            var location = response.headers.location;
            var removeUserUrl = homebaseroot + location + '/users/' + 'user1';
            return request.del(httpHeaders1(removeUserUrl));
        })
        .then(function(response) {
            var url = homebaseroot + '/users/me/threads';
            return request.get(httpHeaders1(url));
        })
        .then(function(resp) {
            var body = JSON.parse(resp.body);
            assert(body.threads.length === 0);
        })
    });

});
