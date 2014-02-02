var spawn = require('child_process').spawn;

var Promise = require('es6-promise').Promise;
var request = require('request');

var db = require('./db');
var server = require('./server');
var settings = require('./settings_local');

// The contents of these types of files should be included in the HAR.
const ALLOWED_CONTENT_TYPES = ['css', 'js', 'json', 'doc'];


function phantomHAR(opts, cb) {
    var output = '';
    var error = '';

    var args = [
        __dirname + '/node_modules/phantomhar/phantomhar.js',
        opts.url
    ];
    if (typeof opts.delay !== 'undefined') {
        args.push(opts.delay);
    }
    var job = spawn('phantomjs', args);

    job.stdout.on('data', function(data) {
        output += data;
    });

    job.stderr.on('data', function(data) {
        error += data;
    });

    console.log('phantomjs output:', output);
    console.error('phantomjs error:', error);

    job.on('exit', function(code) {
        if (code !== 0) {
            if (error) {
                error = 'stderr: ' + error;
            } else {
                error = 'phantomjs ' + args[0] + ' exited: ' + code;
            }
            console.error(error);
        }
        cb(error, output);
    });
}


function processResponses(data, cb) {
    // Fetch each request separately.

    var opts = {};
    var promises = [];

    data.log.entries.forEach(function(entry, idx) {
        promises.push(new Promise(function(resolve, reject) {

            opts = {
                method: entry.request.method,
                url: entry.request.url,
                headers: {},
            };

            entry.request.headers.forEach(function(header) {
                opts.headers[header.name] = header.value;
            });

            request(opts, function(err, res, body) {
                if (err) {
                    return reject({idx: idx, data: err});
                }

                // TODO: Get headersSize.
                entry.response.bodySize = parseInt(res.headers['content-length'], 10);
                entry.response.status = res.statusCode;
                entry.response.content.size = entry.response.bodySize;
                if (ALLOWED_CONTENT_TYPES.indexOf(entry.response.content._type) !== -1) {
                    // Store only non-binary content.
                    entry.response.content.text = body;
                }
                resolve({idx: idx, data: entry});
            });


        }));
    });

    Promise.all(promises).then(function(responses) {
        responses.forEach(function(v) {
            data.log.entries[v.idx] = v.data;
        });
        cb(null, data);
    }).then(function(x) {
        // console.log('Success:', x);
    }, function(x) {
        // console.error('Error:', x);
    });
}


// Sample usage:
// % curl 'http://localhost:5000/har/fetch?url=http://thephantomoftheopera.com'
// % curl -X POST 'http://localhost:5000/har/fetch' -d 'ref=badc0ffee&url=http://thephantomoftheopera.com'

var fetchViewOptions = {
    url: '/har/fetch',
    swagger: {
        nickname: 'fetch',
        notes: 'Fetch site',
        summary: 'Fetch site'
    },
    validation: {
        url: {
            description: 'Site URL',
            isRequired: true,
            isUrl: true
        },
        name: {
            description: 'Name',
            isRequired: false
        },
        ref: {
            description: 'Ref (unique identifier)',
            isRequired: false
        },
        payload: {
            description: 'Payload (from GitHub webhook)',
            isRequired: false
        }
    }
};

function fetchView(req, res) {
    var DATA = req.params;

    var url = encodeURIComponent(DATA.url);
    var delay = DATA.delay;
    var ref = DATA.ref || new Date().toISOString();
    var payload = DATA.payload;
    var sha = null;
    var repoUrl = null;

    if (payload) {
        try {
            payload = JSON.parse(payload);
        } catch(e) {
        }
        if (payload && payload.after &&
            payload.repository && payload.repository.url) {
            sha = payload.after;
            repoUrl = payload.repository.url;
        }
    }

    setTimeout(function() {
        phantomHAR({url: DATA.url, delay: DATA.phantom_delay},
                   function(err, data) {
            if (err) {
                return res.error(400, {error: err});
            }
            // TODO: Allow only one ref.
            data = JSON.parse(data);
            data.log._ref = ref;
            data.log._sha = sha;
            data.log._repo = repoUrl;
            processResponses(data, function(err, data) {
                db.redis.rpush(url, JSON.stringify({har: data}), function(err) {
                    if (err) {
                        return res.error(400, {error: err});
                    }
                    console.log(JSON.stringify(data, null, 4));
                });
            });
        });
    }, DATA.delay || 0);

    res.json({success: true});
}


// Sample usage:
// % curl 'http://localhost:5000/har/history?url=http://thephantomoftheopera.com'
// % curl 'http://localhost:5000/har/history?ref=badc0ffee&url=http://thephantomoftheopera.com'

var historyViewOptions = {
    url: '/har/history',
    swagger: {
        nickname: 'history',
        notes: 'History of network traffic for a site',
        summary: 'Site history'
    },
    validation: {
        url: {
            description: 'Site URL',
            isRequired: true,
            isUrl: true
        },
        ref: {
            description: 'Ref (unique identifier)',
            isRequired: false
        }
    }
};

function historyView(req, res) {
    var DATA = req.params;

    var url = encodeURIComponent(DATA.url);
    var ref = DATA.ref;

    db.redis.lrange(url, 0, -1, function(err, data) {
        if (err) {
            console.error(err);
            return res.json(ref ? {} : []);
        }

        var singleOutput = null;
        var output = [];

        data.forEach(function(entry) {
            entry = JSON.parse(entry);
            if (ref && ref === entry.har.log._ref) {
                // Return HAR for a single ref.
                singleOutput = entry.har;
            }
            output.push(entry.har);
        });

        if (ref) {
            output = singleOutput || {};
        }

        res.json(output);
    });
}


// Sample usage:
// % curl 'http://localhost:5000/stats/history?url=http://thephantomoftheopera.com'
// % curl 'http://localhost:5000/stats/history?ref=badc0ffee&url=http://thephantomoftheopera.com'

var statsViewOptions = {
    url: '/stats/history',
    swagger: {
        nickname: 'stats',
        notes: 'Statistics data of historical network traffic for a site',
        summary: 'Statistics data'
    },
    validation: {
        url: {
            description: 'Site URL',
            isRequired: true,
            isUrl: true
        },
        ref: {
            description: 'Ref (unique identifier)',
            isRequired: false
        }
    }
};

var resourceTypes = [
    'audio',
    'css',
    'cssimage',
    'doc',
    'flash',
    'font',
    'inlinecssimage',
    'inlineimage',
    'js',
    'json',
    'other',
    'total',
    'video'
];

function getStats(har) {
    var data = {sizes: {}, times: {}, totals: {}};

    resourceTypes.forEach(function(type) {
        data.sizes[type] = data.times[type] = data.totals[type] = 0;
    });

    var size;
    var time;
    var type;

    har.log.entries.forEach(function(entry) {
        if (!entry.response || !entry.response.content) {
            return;
        }

        type = entry.response.content._type;
        if (!type || resourceTypes.indexOf(type) === -1) {
            type = 'other';
        }

        size = entry.response.bodySize;
        time = entry.timings.wait + entry.timings.receive;

        data.sizes[type] += size;
        data.times[type] += time;
        data.totals[type]++;

        data.sizes.total += size;
        data.times.total += time;
        data.totals.total++;
    });

    return data;
}

function statsView(req, res, cb) {
    var DATA = req.params;

    var url = encodeURIComponent(DATA.url);
    var ref = DATA.ref;

    db.redis.lrange(url, 0, -1, function(err, data) {
        if (err) {
            console.error(err);
            data = ref ? {} : [];
            if (res) {
                return res.json(data);
            } else {
                return cb(err);
            }
        }

        var singleOutput = null;
        var output = [];
        var stats;

        data.forEach(function(entry) {
            entry = JSON.parse(entry);

            stats = getStats(entry.har);
            stats.ref = entry.har.log._ref;

            if (ref && ref === entry.har.log._ref) {
                // Return stats for a single ref.
                singleOutput = stats;
            }

            output.push(stats);
        });

        if (ref) {
            output = singleOutput || {};
        }

        if (res) {
            res.json(output);
        } else {
            cb(null, output);
        }
    });
}


// Sample usage:
// % curl 'http://localhost:5000/charts/sizes?url=http://thephantomoftheopera.com'
// % curl 'http://localhost:5000/charts/times?url=http://thephantomoftheopera.com'
// % curl 'http://localhost:5000/charts/totals?url=http://thephantomoftheopera.com'
// % curl 'http://localhost:5000/charts/totals?resource=css&ref=badc0ffee&url=http://thephantomoftheopera.com'

var chartsViewOptions = {
    url: '/charts/:stat',
    swagger: {
        nickname: 'charts',
        notes: 'Charts data of historical network traffic for a site ' +
               '(normalised for JS frontend)',
        summary: 'Charts data'
    },
    validation: {
        url: {
            description: 'Site URL',
            isRequired: true,
            isUrl: true
        },
        ref: {
            description: 'Ref (unique identifier)',
            isRequired: false
        },
        resource: {
            description: 'Resource type to filter by',
            isRequired: false,
            isIn: resourceTypes
        },
        stat: {
            description: 'Statistic type',
            isRequired: true,
            isIn: ['sizes', 'times', 'totals'],
            scope: 'path'
        },
        exclude: {
            description: 'Resource type to exclude',
            isRequired: false,
            isIn: resourceTypes
        }
    }
};

function chartsView(req, res) {
    var DATA = req.params;

    var stat = DATA.stat;
    var resourceType = DATA.resource;
    var exclude = DATA.exclude;

    var types = resourceTypes.slice(0);
    if (resourceType) {
        types = [resourceType];
    }

    statsView(req, null, function(err, data) {
        if (err) {
            console.error(err);
            return res.json({});
        }

        var output = {
            // One label per ref.
            labels: [],

            // One dataset entry per resource type.
            datasets: []
        };

        // Tally each resource type (so we know which keys to omit later).
        var resourceTotals = {};

        types.forEach(function(type, idx) {
            // One data entry per ref.
            output.datasets[idx] = [type];

            // Set counter for each resource type.
            resourceTotals[type] = 0;
        });

        var whichDataset;

        data.forEach(function(entry) {
            output.labels.push(entry.ref);

            Object.keys(entry.totals).forEach(function(k) {
                resourceTotals[k] += entry.totals[k];
            });

            Object.keys(entry[stat]).forEach(function(k) {
                if (resourceType && k !== resourceType) {
                    return;
                }

                // Look up the dataset for this resource type.
                whichDataset = output.datasets[types.indexOf(k)];

                // Push the value onto the array for aforementioned dataset.
                whichDataset.push(entry[stat][k]);
            });
        });

        // Omit a particular resource type if no requests of that type were
        // ever made throughout the entire history recorded for this site.
        output.datasets = output.datasets.filter(function(dataset) {
            if (exclude && dataset[0] === exclude) {
                return false;
            }
            return resourceTotals[dataset[0]];
        });

        res.json(output);
    });
}

server.get(fetchViewOptions, fetchView);
server.post(fetchViewOptions, fetchView);


server.get(historyViewOptions, historyView);


server.get(statsViewOptions, statsView);


server.get(chartsViewOptions, chartsView);


server.listen(process.env.PORT || settings.PORT || 5000, function() {
    console.log('%s listening at %s', server.name, server.url);
});
