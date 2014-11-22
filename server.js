//jshint node: true
var express    = require('express'),
    events     = require('events'),
    http       = require('http'),
    engine     = require('engine.io'),
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

var eventEmitter = new events.EventEmitter();
var providersName = {};
// Web Activities
(function () {
  "use strict";
  app.post('/activity', function (req, res) {
    var registered = activity.handleActivity(req.body, res).map(function (handler) {
      handler.fullname = providersName[handler.href] || handler.href;
      return handler;
    });
    console.log(registered, providersName);
    if (typeof req.body.handler !== 'undefined') {
      eventEmitter.on('activitySent', function (result) {
        res.status(200).json(result);
      });
      eventEmitter.emit('activityWaiting');
    } else {
      res.status(200).json(registered);
    }
  });
  app.get('/activity/pending', function (req, res) {
    var pending = activity.hasPendingMessage(req);
    res.send(JSON.stringify({result: pending}));
  });
  app.post('/activity/register', function (req, res) {
    activity.registerActivityHandler(req.body);
    res.status(200).json({result: 'ok'});
  });
}());

// Starts the server itself
var httpServer = http.createServer(app).listen(port, host, function() {
  "use strict";
  console.log("Server listening to %s:%d within %s environment", host, port, app.get('env'));
});
var server = engine.attach(httpServer);
server.on('connection', function(socket){
  "use strict";
  var name, provider;
  socket.on('message', function(data){
    data = JSON.parse(data);
    console.log("GOT MESSAGE", data);
    if (data.type === 'providerUrl') {
      name     = data.data.name;
      provider = data.data.url;
      providersName[provider] = name;
    }
    if (data.type === 'success' || data.type === 'error') {
        eventEmitter.emit('activitySent', data);
    }
  });
  eventEmitter.on('activityWaiting', function () {
    if (typeof provider === 'undefined') {
      console.log('No provider');
      return;
    }
    socket.send(JSON.stringify(activity.getPendingMessages(provider)));
  });
});

