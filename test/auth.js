
var jwt = require('jsonwebtoken');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync(__dirname+'/../config.json'));
exports.tokenForUser = function tokenForUser(userid) {
    var expDate = new Date();
    expDate.setDate(expDate.getDate() + 14); //14 days into future
    return jwt.sign({id: userid ,exp: expDate.getTime()}, config.secret);
}


