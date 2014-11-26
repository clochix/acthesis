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

// Serve samples
if (process.env.SAMPLE) {
  app.use(express.static(__dirname + '/sample/'));
}

// Enable CORS
app.use(function(req, res, next) {
  "use strict";
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Requester");
  next();
});

var eventEmitter = new events.EventEmitter();
// Web Activities
(function () {
  "use strict";
  app.post('/activity', function (req, res) {
    var registered, choosen, timeout;
    registered = activity.handleActivity(req.body, res);
    if (typeof req.body.handler !== 'undefined') {
      choosen = registered.filter(function (handler) {
        return handler.href === req.body.handler;
      })[0];
      if (choosen.returnValue) {
        timeout = setTimeout(function () {
          eventEmitter.emit('activitySent', {type: 'error', data: "TIMEOUT"});
        }, 30000);
        eventEmitter.once('activitySent', function (result) {
          clearTimeout(timeout);
          res.status(200).json(result);
        });
      } else {
        activity.deletePendingMessages(choosen.href);
        res.status(200).json({type: 'success'});
      }
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
    var domRequest = activity.registerActivityHandler(req.body);
    domRequest.onsuccess = function () {
      res.status(200).json({result: 'ok'});
    };
    domRequest.onerror = function () {
      res.status(500).json({result: 'ko'});
    };
  });
  app.post('/activity/unregister', function (req, res) {
    var domRequest = activity.unregisterActivityHandler(req.body);
    domRequest.onsuccess = function () {
      res.status(200).json({result: 'ok'});
    };
    domRequest.onerror = function () {
      res.status(500).json({result: 'ko'});
    };
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
  var provider;
  function sendPending() {
    if (typeof provider === 'undefined') {
      console.log('No provider');
      return;
    }
    var pending = activity.getPendingMessages(provider);
    if (typeof pending !== 'undefined') {
      //console.log("Sending ", pending);
      socket.send(JSON.stringify(pending));
    }
  }
  socket.on('message', function(data){
    data = JSON.parse(data);
    //console.log("GOT MESSAGE", data);
    if (data.type === 'providerUrl') {
      provider = data.data.url;
    }
    if (data.type === 'success' || data.type === 'error') {
        activity.deletePendingMessages(provider);
        eventEmitter.emit('activitySent', data);
    }
    if (data.type === 'getPending') {
      sendPending();
    }
  });
  eventEmitter.on('activityWaiting', sendPending);
  socket.on('disconnect', function () {
    eventEmitter.removeListener('activityWaiting', sendPending);
  });
});

