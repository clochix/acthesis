//jshint node: true
//////
//
// Server Activity Polyfill
//
/////
var platform   = {};
var handlers   = {};
var registered = {};
var queue      = {};
var activity = require('./activity-common.js');
var ActivityRequestHandler = activity.ActivityRequestHandler;
var Request = activity.Request;
platform.setMessageHandler = function (type, handler) {
  "use strict";
  if (typeof handlers[type] === 'undefined') {
    handlers[type] = [];
  }
  handlers[type].push(handler);
  if (platform.hasPendingMessage(type)) {
    queue[type].forEach(function (message) {
      // Message is an ActivityRequestHandler
      handler(message);
    });
  }
};
platform.hasPendingMessage = function (type) {
  "use strict";
  if (typeof queue[type] === 'undefined') {
    queue[type] = [];
  }
  return queue[type].length > 0;
};
platform.registerActivityHandler = function (description) {
  "use strict";
  if (typeof registered[description.name] === 'undefined') {
    registered[description.name] = [];
  }
  registered[description.name].push(description);
  return new Request();
};
platform.unregisterActivityHandler   = function (description) {};
platform.isActivityHandlerRegistered = function (handler) {};

// Test code
platform.setMessageHandler('share', function (a) {
  "use strict";
  a.postResult(a.source);
});

platform.handleActivity = function (body, res) {
  "use strict";
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
};
module.exports = platform;
