//jshint node: true
var express    = require('express'),
    http       = require('http'),
    bodyParser = require('body-parser'),
    activity   = require('./lib/index');
process.on('uncaughtException', function (err) {
  "use strict";
  console.error("Uncaught Exception");
  console.error(err);
  console.error(err.stack);
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
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
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Requester");
  next();
});

// Starts the server itself
var httpServer = http.createServer(app).listen(port, host, function() {
  "use strict";
  console.log("Server listening to %s:%d within %s environment", host, port, app.get('env'));
});
app.use(activity({httpServer: httpServer}));
