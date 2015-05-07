var request = require('request-promise');
var assert = require("assert");
var http = require('./http');
var auth = require('./auth');
var tokenForUser = auth.tokenForUser;
var httpHeadersForToken = http.httpHeadersForToken;
var postHeaders = http.postHeaders;
var createThread = http.createThread;
var cleanDatabase = http.cleanDatabase;

var userid1 = 'user1';
var userid2 = 'user2';

var homebaseroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls.homebase;

var loginToken1 = tokenForUser(userid1);
var loginToken2 = tokenForUser(userid2);
var httpHeaders1 = httpHeadersForToken(loginToken1);
var httpHeaders2 = httpHeadersForToken(loginToken2);

describe('http.threads', function() {
    it('should fetch list of own user\'s threads', function () {
        return cleanDatabase()
        .then(function() {
            createThread(['user1', 'user2', 'user3'], 'user1');
            createThread(['user1', 'user2', 'user3'], 'user2');
            createThread(['user1', 'user2', 'user3'], 'user3');
            createThread(['user1', 'user2', 'user3'], 'user4');
            return createThread(['user1', 'user2', 'user3'], 'user5');
        })
        .then(function() {
            var url = [homebaseroot, 'users', userid1, 'threads'].join('/');
            return request.get(httpHeaders1(url))
            .then(function(response) {
                assert.equal(200, response.statusCode); //will throw if unequal
                return JSON.parse(response.body);
            })
            .then(function(body){
                assert(body.threads.length == 5); // check that returned body has rows.
            });
        });
    });

    it('should create new private thread', function() {
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

    it('should create new group chat', function() {
        var url = [homebaseroot,'threads'].join('/');
        return request.post(postHeaders(url,{
                "users": ['user1', 'user2', 'user3']
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


    it('should fail to create new thread because of auth', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return request.post(postHeaders(url, {
                    "users": ['Olle', 'user1']
                }, httpHeadersForToken(tokenForUser('Olle')))
            )
            .catch(function(error) {
                assert.equal(500, error.statusCode);
            })
        })
    });

    it('should return same thread id for a private chat created with same users', function() {
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

    it('should return 404 if group has no group name', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user3'], 'user2');
        })
        .then(function(response) {
            location = response.headers.location;
            var url = homebaseroot + location + '/name';
            return request.get(httpHeaders1(url))
            .catch(function(error) {
                assert.equal(404, error.statusCode);
                return Promise.resolve();
            })
        })
    });

    it('should return group name specified when creating the group', function() {
        return cleanDatabase()
        .then(function() {
             var url = [homebaseroot, 'threads'].join('/');
             return request.post(postHeaders(url, {
                        "users": ['user1', 'user2', 'user3'],
                        "name": "hejsan"
                    },
                    httpHeadersForToken(tokenForUser('user2'))
                )
            );
        })
        .then(function(response) {
            var location = response.headers.location;
            var url = homebaseroot + location + '/name';
            return request.get(httpHeaders1(url));
        })
        .then(function(httpResponse) {
            var body = JSON.parse(httpResponse.body);
            assert.equal('hejsan', body.name);
        })
    });

    it('should be able to change the group name as creator', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2', 'user3'], 'user1');
        })
        .then(function(response) {
            location = response.headers.location;
            var url = homebaseroot + location + '/name';
            return request.put(postHeaders(url, {"name": 'hejsan'}, httpHeadersForToken(tokenForUser('user1'))));
        })
        .then(function() {
            var url = homebaseroot + location + '/name';
            return request.get(httpHeaders1(url));
        })
        .then(function(resp) {
            var body = JSON.parse(resp.body);
            assert.equal('hejsan', body.name);
        });
    });

    it('should not be able to change the group name if not creator', function() {
        var location;
        return cleanDatabase()
        .then(function() {
            return createThread(['user1', 'user2', 'user3'], 'user1');
        })
        .then(function(response) {
            location = response.headers.location;
            var url = homebaseroot + location + '/name';
            return request.put(postHeaders(url, {"name": 'hejsan'}, httpHeadersForToken(tokenForUser('user1'))))
            .catch(function(error) {
                console.log(error.statusCode);
            });
        });
    });

    it('should remove the group name if creator', function() {
        var location;
        return cleanDatabase()
        .then(function() {
             var url = [homebaseroot, 'threads'].join('/');
             return request.post(postHeaders(url, {
                        "users": ['user1', 'user2', 'user3'],
                        "name": "hejsan"
                    },
                    httpHeadersForToken(tokenForUser('user2'))
                )
            );
        })
        .then(function(response) {
            location = response.headers.location;
            var url = homebaseroot + location + '/name';
            return request.del(httpHeaders2(url));
        })
        .then(function() {
            var url = homebaseroot + location;
            return request.get(httpHeaders1(url));
        })
        .then(function(resp) {
            var body = JSON.parse(resp.body);
            assert(!body.thread.name);
        })
    });

    it('should not remove the group name if not creator', function() {
        return cleanDatabase()
        .then(function() {
             var url = [homebaseroot, 'threads'].join('/');
             return request.post(postHeaders(url, {
                        "users": ['user1', 'user2', 'user3'],
                        "name": "hejsan"
                    },
                    httpHeadersForToken(tokenForUser('user2'))
                )
            );
        })
        .then(function(response) {
            var url = homebaseroot + response.headers.location + '/name';
            return request.del(httpHeaders1(url))
            .catch(function(error) {
                assert.equal(403, error.statusCode);
            });
        });
    });

    it('should provide group name when requesting a thread', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return request.post(postHeaders(url, {
                "users": ['user1', 'user2', 'user3'],
                "name": "Hej"
                 },
                httpHeaders2)
            );
        })
        .then(function(response) {
            var location = response.headers.location;
            var url = homebaseroot + location;
            return request.get(httpHeaders1(url));
        })
        .then(function(httpResponse) {
            var body = JSON.parse(httpResponse.body);
            assert.notEqual(undefined, body.thread.name);
        })
    });

    it('should not be possible to create a thread with a user that is blocking you', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return createThread(['caboose'], 'pelle')
            .catch(function(error) {
                assert.equal(400, error.statusCode);
            })
        })
        .then(function(resp) {
            assert(undefined === resp);
        })
    });

    it('should not be possible to create a thread with a user that you are blocking', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return createThread(['ida'], 'pelle')
            .catch(function(error) {
                assert.equal(400, error.statusCode);
            })
        })
        .then(function(resp) {
            assert(undefined === resp);
        })
    });

    it('should not be possible to add a user that is blocking you to a thread', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return createThread(['user1', 'user2'], 'pelle');
        })
        .then(function(response) {
            var location = response.headers.location;
            var url = homebaseroot + location + '/users';
            return request.post(postHeaders(url, {
                        "users": ["caboose"]
                    },
                    httpHeadersForToken(tokenForUser('pelle'))
                    )
            )
            .catch(function(error) {
                assert.equal(400, error.statusCode);
            })
        })
        .then(function(resp) {
            assert(undefined === resp);
        })
    });

    it('should not be possible to add a user to a thread that you are blocking', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return createThread(['user1', 'user2'], 'pelle');
        })
        .then(function(response) {
            var location = response.headers.location;
            var url = homebaseroot + location + '/users';
            return request.post(postHeaders(url, {
                        "users": ["ida"]
                    },
                    httpHeadersForToken(tokenForUser('pelle'))
                    )
            )
            .catch(function(error) {
                assert.equal(400, error.statusCode);
            })
        })
        .then(function(resp) {
            assert(undefined === resp);
        })
    });

    it('should return private chat field', function() {
        return cleanDatabase()
        .then(function() {
            var url = homebaseroot + '/threads';
            return createThread(['user1', 'user3'], 'user3');
        })
        .then(function(response) {
            var url = homebaseroot + response.headers.location;
            return request.get(httpHeaders1(url));
        })
        .then(function(httpResponse) {
            var body = JSON.parse(httpResponse.body);
            assert(body.thread.private);
        });
    });

});
