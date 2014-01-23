var spawn = require('child_process').spawn;

var db = require('./db');
var server = require('./server');


function phantomHAR(url, cb) {
    var output = '';
    var error = '';

    var args = [
        __dirname + '/node_modules/phantomhar/phantomhar.js',
        url
    ];
    var job = spawn('phantomjs', args);

    job.stdout.on('data', function(data) {
        output += data;
    });

    job.stderr.on('data', function(data) {
        error += data;
    });

    job.on('exit', function(code) {
        if (code !== 0) {
            if (error) {
                error = 'stderr: ' + error;
            } else {
                error = 'phantomjs ' + args[0] + ' exited: ' + code;
            }
        }
        cb(error, output);
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
        }
    }
};

function fetchView(req, res) {
    var DATA = req.params;

    var url = encodeURIComponent(DATA.url);
    var ref = DATA.ref || new Date().toISOString();

    phantomHAR(DATA.url, function(err, data) {
        if (err) {
            return res.error(400, {error: err});
        }
        // TODO: Allow only one ref.
        data = JSON.parse(data);
        data.log._ref = ref;
        db.push(url, {har: data}, function(err) {
            if (err) {
                return res.error(400, {error: err});
            }
        });
        console.log(data);
    });

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

    db.get(url, function(err, data) {
        if (err) {
            console.error(err);
            return res.json(ref ? {} : []);
        }

        var singleOutput = null;
        var output = [];

        (data || []).some(function(entry, idx) {
            if (ref && ref === entry.har.log._ref) {
                // Return HAR for a single ref.
                return singleOutput = entry.har;
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
    'video'
];

function getStats(har) {
    var data = {sizes: {}, times: {}, totals: {}};

    resourceTypes.forEach(function(type) {
        data.sizes[type] = data.times[type] = data.totals[type] = 0;
    });

    var type;
    har.log.entries.forEach(function(entry) {
        if (!entry.response || !entry.response.content) {
            return;
        }

        type = entry.response.content.type;
        if (!type || resourceTypes.indexOf(type) === -1) {
            type = 'other';
        }

        data.sizes[type] += entry.response.bodySize;
        data.times[type] += entry.time;
        data.totals[type]++;
    });

    return data;
}

function statsView(req, res, cb) {
    var DATA = req.params;

    var url = encodeURIComponent(DATA.url);
    var ref = DATA.ref;

    db.get(url, function(err, data) {
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

        (data || []).forEach(function(entry) {
            stats = getStats(entry.har);
            stats.ref = entry.har.log._ref;

            if (ref && ref === entry.har.log._ref) {
                // Return stats for a single ref.
                return singleOutput = stats;
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
            description: 'Resource Type',
            isRequired: false,
            isIn: resourceTypes,
        },
        stat: {
            description: 'Statistic type',
            isRequired: true,
            isIn: ['sizes', 'times', 'totals'],
            scope: 'path'
        }
    }
};

function chartsView(req, res) {
    var DATA = req.params;

    var stat = DATA.stat;
    var resourceType = DATA.resource;

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


server.listen(process.env.PORT || 5000, function() {
    console.log('%s listening at %s', server.name, server.url);
});
