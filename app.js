'use strict';
const express = require('express');
const bodyParser = require('body-parser');

// Use the prom-client module to expose our metrics to Prometheus
const client = require('prom-client');

// enable prom-client to expose default application metrics
const collectDefaultMetrics = client.collectDefaultMetrics;

// define a custom prefix string for application metrics
collectDefaultMetrics({ prefix: 'nodejs_sample:' });

const histogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds histogram',
  labelNames: ['method', 'handler', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 500],
});

const app = express();
const port = process.argv[2] || 8080;

let failureCounter = 0;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/greeting', async (req, res) => {
  const end = histogram.startTimer();
  const name = req.query?.name || 'World';

  try {
    const result = await somethingThatCouldFail(`Hello, ${name}`);
    res.send({ message: result });
  } catch (err) {
    res.status(500).send({ error: err.toString() });
  }

  res.on('finish', () =>
    end({
      method: req.method,
      handler: new URL(req.url, `http://${req.hostname}`).pathname,
      code: res.statusCode,
    })
  );
});

// expose our metrics at the default URL for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
});

app.listen(port, () => console.log(`Express app listening on port ${port}!`));

function somethingThatCouldFail(echo) {
  if (Date.now() % 5 === 0) {
    return Promise.reject(`Random failure ${++failureCounter}`);
  } else {
    return Promise.resolve(echo);
  }
}