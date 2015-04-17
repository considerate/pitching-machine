var request = require('request-promise');
var assert = require("assert");
var http = require('./http');
var auth = require('./auth');
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

describe('http.threads', function() {
    it('should fetch list of own user\'s threads', function () {
        var url = [homebaseroot, 'users', userid1, 'threads'].join('/');
        return request.get(httpHeaders1(url))
        .then(function(response) {
            assert.equal(200, response.statusCode); //will throw if unequal
            return JSON.parse(response.body);
        })
        .then(function(body){
            assert(body.threads); // check that returned body has rows.
        });
    });

    it('should create new thread', function() {
        var url = [homebaseroot,'threads'].join('/');
        return request.post(postHeaders(url,{
            "users": ['user1', 'user2']
        },httpHeaders1))
        .then(function(response) {
            assert.equal(201, response.statusCode);
            var location = response.headers.location;
            var locationUrl = homebaseroot + location;
            return request.get(httpHeaders1(locationUrl))
            .then(function(response) {
                assert.equal(200, response.statusCode);
            });
        });
    });

    it('should create another new thread', function() {
        var url = [homebaseroot,'threads'].join('/');
        return request.post(postHeaders(url,{
            "users": ['user3', 'user4']
        }, httpHeaders1))
        .then(function(response) {
            assert.equal(201, response.statusCode);
            var location = response.headers.location;
            var locationUrl = homebaseroot + location;
            return request.get(httpHeaders1(locationUrl))
            .then(function(response) {
                assert.equal(200, response.statusCode);
            });
        });
    });

    it('should return same thread id for a private chatt created with same users', function() {
        return cleanDatabase()
        .then(function(){
            return createThread(['user1','user2'], 'user1')
            .then(function(response) {
                return createThread(['user2','user1'], 'user2')
                .then(function(responseTwo) {
                    assert.equal(response.headers.location,
                                 responseTwo.headers.location);
                });
            });
        });
    });
});
