var level = require('level');
var levelplus = require('levelplus');


module.exports = levelplus(level('./db/har', {
    keyEncoding: 'utf8',
    valueEncoding: 'json'
}));
