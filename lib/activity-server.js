//jshint node: true
//////
//
// Server Activity Polyfill
//
/////
var platform   = {};
var registered = {};
var queue      = {};
var activity = require('./activity-common.js');
//var ActivityRequestHandler = activity.ActivityRequestHandler;
var Request = activity.Request;
platform.hasPendingMessage = function (req) {
  "use strict";
  var handler = req.get('X-Requester'),
      type = req.query.type;
  console.log(handler, type, queue);
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
  return new Request();
};
platform.unregisterActivityHandler   = function (description) {};
platform.isActivityHandlerRegistered = function (handler) {};


platform.handleActivity = function (body, res) {
  "use strict";
  if (typeof body.handler !== 'undefined') {
    if (typeof queue[body.handler] === 'undefined') {
      queue[body.handler] = [];
    }
    queue[body.handler].push(body);
    console.log(queue);
  }
  return registered[body.name] || [];
  /*
  var arh, activity, onsuccess, onerror;
  if (typeof handlers[body.name] !== 'undefined') {
    onsuccess = function (result) {
      res.send(JSON.stringify(this));
    };
    onerror = function (result) {
      res.send(JSON.stringify(this));
    };
    arh = new ActivityRequestHandler(body, onsuccess, onerror);
    handlers[body.name].forEach(function (handler) {
      handler(arh);
    });
  } else {
    activity = new Request(body);
    activity.onsuccess = function (result) {
      res.send(JSON.stringify(this));
    };
    activity.onerror = function (result) {
      res.send(JSON.stringify(this));
    };
  }
  */
};
module.exports = platform;
