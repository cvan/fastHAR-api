# fastHAR-api

An API server that returns aggregated data from
[HTTP Archive (HAR)](https://dvcs.w3.org/hg/webperf/raw-file/tip/specs/HAR/Overview.html)
data from captured network traffic. This is the API for
[fastHAR](https://github.com/cvan/fastHAR).


# Installation

Install dependencies:

    npm install

Run server:

    PORT=5000 node app.js


# API usage

## Fetch a site to record its network traffic

Each fetch becomes a new record in the database and can be looked up later.

### `GET`

    curl 'http://localhost:5000/har/fetch?name=The Phantom of the Opera&url=http://thephantomoftheopera.com'

Or by specifying a `ref` identifier (e.g., a SHA or some unique identifier):

    curl 'http://localhost:5000/har/fetch?ref=badc0ffee&url=http://thephantomoftheopera.com'

Or even simpler:

    curl 'http://localhost:5000/har/fetch?url=http://thephantomoftheopera.com'

### `POST`

    curl -X POST 'http://localhost:5000/har/fetch' -d 'name=The Phantom of the Opera&ref=badc0ffee&url=http://thephantomoftheopera.com'

Or even simpler:

    curl -X POST 'http://localhost:5000/har/fetch' -d 'url=http://thephantomoftheopera.com'

## Return a site's network traffic history

### HAR data

    curl 'http://localhost:5000/har/history?url=http://thephantomoftheopera.com'

### Statistics data (response size, times, totals)

    curl 'http://localhost:5000/stats/history?url=http://thephantomoftheopera.com'

### Charts data (normalised statistics data)

Note: the following endpoints can all be filtered by `ref`.

#### Filter by response size

    curl 'http://localhost:5000/charts/sizes?url=http://thephantomoftheopera.com'

To filter by resource type (e.g., `css`):

    curl 'http://localhost:5000/charts/sizes?resource=css&url=http://thephantomoftheopera.com'

#### Filter by response time

    curl 'http://localhost:5000/charts/times?url=http://thephantomoftheopera.com'

To filter by resource type (e.g., `css`):

    curl 'http://localhost:5000/charts/times?resource=css&url=http://thephantomoftheopera.com'

#### Filter by total counts

    curl 'http://localhost:5000/charts/totals?url=http://thephantomoftheopera.com'

To filter by resource type (e.g., `css`):

    curl 'http://localhost:5000/charts/totals?resource=css&url=http://thephantomoftheopera.com'
