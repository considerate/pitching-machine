var auth = require('./auth');
var tokenForUser = auth.tokenForUser;
var homebaseroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls.homebase;
var couchdbroot = JSON.parse(require('fs').readFileSync(__dirname+'/../config.json')).urls.couch;
var request = require('request-promise');
var assert = require('assert');

function httpHeadersForToken(token) {
    return function headers(url) {
        return {
            url: url,
            resolveWithFullResponse: true,
            headers: {
                'Authorization': 'Bearer '+token,
                'Content-Type': 'application/json'
            }
        };
    }
};
exports.httpHeadersForToken = httpHeadersForToken;

function postHeaders(url, body, httpHeaders) {
    var options = httpHeaders(url);
    if(typeof body === 'object') {
        body = JSON.stringify(body);
    }
    options.followAllRedirects = true;
    options.body = body;
    return options;
}
exports.postHeaders =  postHeaders;

function createThread(users, creator) {
    var url = [homebaseroot, 'threads'].join('/');
    return  request.post(postHeaders(url,
            {"users": users},
            httpHeadersForToken(tokenForUser(creator))
            )
    );
}
exports.createThread = createThread;

function cleanDatabase() {
    return request.get([couchdbroot,'_all_docs?startkey="_design/"&endkey="_design0"'].join('/'))
    .then(function(designdocstext) {
        var designdocs = JSON.parse(designdocstext).rows.map(function(doc) {
           return doc.id;
        });
        return request.get([couchdbroot,'_all_docs'].join('/'))
        .then(function(alldocstext) {
            var alldocs = JSON.parse(alldocstext).rows;
            var toRemove = alldocs.filter(function(doc){
                var index = designdocs.indexOf(doc.id);
                return index === -1;
            }).map(function (doc) {
                doc.value._deleted = true;
                doc.value._id = doc.id;
                doc.value._rev = doc.value.rev;
                return doc.value;
            });
            var bulk = {
                docs: toRemove
            };
            return request.post({
                url: [couchdbroot,'_bulk_docs'].join('/'),
                body: JSON.stringify(bulk),
                headers: {
                   'Content-Type': 'application/json'
                }
            }).then(function(body) {
                return request.get([couchdbroot,'_all_docs'].join('/'))
                .then(function(body) {
                    var data = JSON.parse(body);
                    assert.equal(designdocs.length, data.rows.length);
                });
            });
        });
    });
}
exports.cleanDatabase = cleanDatabase;

