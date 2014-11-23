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

// ES6 Polyfills {{{
// Array.findIndex @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function(predicate) {
    //jshint bitwise: false
    "use strict";
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}
// }}}
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
  if (!description.disposition) {
    description.disposition = 'window';
  }
  var idx = registered[description.name].findIndex(function (e) { return e.href === description.href;});
  if (idx === -1) {
    registered[description.name].push(description);
  } else {
    registered[description.name][idx] = description;
  }
  fs.writeFileSync(configPath, JSON.stringify(registered));
  return new Request();
};
platform.unregisterActivityHandler   = function (description) {
  "use strict";
  registered[description.name] = registered[description.name].filter(function (e) { return e.href !== description.href;});
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
