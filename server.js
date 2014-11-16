//jshint node: true
var express    = require('express'),
    http       = require('http'),
    bodyParser = require('body-parser'),
    activity   = require('./lib/activity-server');
process.on('uncaughtException', function (err) {
  "use strict";
  console.error("Uncaught Exception");
  console.error(err);
  console.error(err.stack);
});

var app = express();
app.use(bodyParser.json());
var port = process.env.PORT || 9250;
var host = process.env.HOST || "127.0.0.1";

// Serve static content
app.use(express.static(__dirname + '/sample/'));

// Web Activities
(function () {
  "use strict";
  app.post('/activity', function (req, res) {
    console.log(req.get('X-Requester'));
    activity.handleActivity(req.body, res);
  });
  app.get('/activity/pending', function (req, res) {
    var pending = activity.hasPendingMessage(req);
    res.send(JSON.stringify({result: pending}));
  });
  app.post('/activity/register', function (req, res) {
    console.log(req.get('X-Requester'));
    activity.registerActivityHandler(req.body);
    res.status(200).json({result: 'ok'});
  });
}());

// Starts the server itself
http.createServer(app).listen(port, host, function() {
  "use strict";
  console.log("Server listening to %s:%d within %s environment", host, port, app.get('env'));
});

