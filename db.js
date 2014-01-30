var urllib = require('url');

var redis = require('redis');

var redisURL = urllib.parse(process.env.REDIS_URL ||
                            process.env.REDISCLOUD_URL ||
                            process.env.REDISTOGO_URL ||
                            '');
redisURL.hostname = redisURL.hostname || 'localhost';
redisURL.port = redisURL.port || 6379;


function redisClient() {
    var client = redis.createClient(redisURL.port, redisURL.hostname);
    if (redisURL.auth) {
        client.auth(redisURL.auth.split(':')[1]);
    }
    return client;
}
module.exports.redis = redisClient();
