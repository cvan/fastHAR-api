var level = require('level');
var levelplus = require('levelplus');

var settings = require('./settings_local');


module.exports = levelplus(level('./db/har', {
    keyEncoding: 'utf8',
    valueEncoding: 'json'
}));

if (settings.DEBUG) {
    var levelHUD = require('levelhud');
    new levelHUD().use(module.exports).listen(4420);
}
