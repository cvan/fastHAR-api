var restify = require('restify');
var restifySwagger = require('node-restify-swagger');
var restifyValidation = require('node-restify-validation');


var server = restify.createServer({
    name: 'fastHAR-api',
    version: '0.0.1'
});

server.use(restify.bodyParser());
server.use(restify.CORS());
server.use(restify.gzipResponse());
server.use(restify.queryParser());
server.use(restifyValidation.validationPlugin({errorsAsArray: false}));

restifySwagger.configure(server);
restifySwagger.loadRestifyRoutes();

module.exports = server;
