//jshint node: true
//////
//
// Server Activity Polyfill
//
/////
var fs = require('fs'),
    platform   = {},
    registered = {},
    queue      = {},
    activity = require('./activity-common.js'),
    Request = activity.Request,
    configPath = 'config.json';
if (fs.existsSync(configPath)) {
  fs.readFile(configPath, function (err, data) {
    "use strict";
    if (!err) {
      registered = JSON.parse(data);
    }
  });
}
platform.hasPendingMessage = function (req) {
  "use strict";
  var handler = req.get('X-Requester'),
      type = req.query.type;
  if (!Array.isArray(queue[handler])) {
    return false;
  }
  return queue[handler].some(function (e) { return e.name === type; });
};
platform.getPendingMessages = function (requester) {
  "use strict";
  var res = queue[requester];
  queue[requester] = [];
  return res;
};
platform.registerActivityHandler = function (description) {
  "use strict";
  if (typeof registered[description.name] === 'undefined') {
    registered[description.name] = [];
  }
  if (!registered[description.name].some(function (e) { return e.href === description.href;})) {
    registered[description.name].push(description);
  }
  fs.writeFileSync(configPath, JSON.stringify(registered));
  return new Request();
};
platform.unregisterActivityHandler   = function (description) {
  "use strict";
  delete registered[description.name];
  fs.writeFileSync(configPath, JSON.stringify(registered));
  return new Request();
};

platform.handleActivity = function (body, res) {
  "use strict";
  if (typeof body.handler !== 'undefined') {
    if (typeof queue[body.handler] === 'undefined') {
      queue[body.handler] = [];
    }
    queue[body.handler].push(body);
  }
  return registered[body.name] || [];
};
module.exports = platform;
