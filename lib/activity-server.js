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
    configPath = 'config.json';

registered = {
  activity: [],
  alarm: [],
  notification: [],
  push: []
};

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
function Request(options) {
  "use strict";
  var self = this;
  self.readyState = 'pending';
  self.result = null;
  self.error  = null;
  function done (err, res) {
    self.readyState = 'done';
    if (err) {
      if (typeof self.onerror === 'function') {
          self.error = err;
          self.onerror.call(self);
      }
    } else {
      if (typeof self.onsuccess === 'function') {
        self.result = res;
        self.onsuccess.call(self);
      }
    }
  }
  setTimeout(done, 100);
}
if (fs.existsSync(configPath)) {
  fs.readFile(configPath, function (err, data) {
    "use strict";
    if (!err) {
      registered = JSON.parse(data);
    }
  });
}
platform.hasPendingMessage = function (handler, type) {
  "use strict";
  if (!Array.isArray(queue[handler])) {
    return false;
  }
  return queue[handler].some(function (e) { return e.type === type; });
};
platform.getPendingMessages = function (requester, type, del) {
  "use strict";
  if (!Array.isArray(queue[requester])) {
    return [];
  }
  var res = queue[requester].filter(function (e) { return e.type === type; });
  if (del === true) {
     queue[requester] = queue[requester].filter(function (e) { return e.type !== type; });
  }
  return res;
};
platform.deletePendingMessages = function (requester, id) {
  "use strict";
  if (!Array.isArray(queue[requester]) || queue[requester].length === 0) {
    console.log("No pending message to delete", requester, queue);
    return;
  }
  queue[requester] = queue[requester].filter(function (e) { return e.id !== id; });
};
platform.registerActivityHandler = function (description) {
  "use strict";
  if (!description.disposition) {
    description.disposition = 'window';
  }
  var idx = registered.activity.findIndex(function (e) { return e.href === description.href;});
  if (idx === -1) {
    registered.activity.push(description);
  } else {
    registered.activity[idx] = description;
  }
  fs.writeFileSync(configPath, JSON.stringify(registered, null, 2));
  return new Request();
};
platform.unregisterActivityHandler   = function (description) {
  "use strict";
  registered.activity = registered.activity.filter(function (e) { return e.href !== description.href;});
  fs.writeFileSync(configPath, JSON.stringify(registered, null, 2));
  return new Request();
};

platform.activityMatch = function (filters, activity) {
  "use strict";
  var keys = Object.keys(filters);
  return keys.every(function (key) {
    //jshint maxcomplexity: 100, maxstatements: 100
    var filter, val, re;
    filter = filters[key];
    if (typeof activity.data === 'object') {
      val = activity.data[key];
    }
    if (Array.isArray(filter)) {
      return typeof val === 'undefined' || filter.some(function (f) {
        return f === val;
      });
    } else if (typeof filter === 'object') {
      if (filter.required === true && typeof val === 'undefined') {
        return false;
      }
      if (typeof filter.value !== 'undefined') {
        if (Array.isArray(filter.value) && filter.value.indexOf(val) === -1) {
          return false;
        }
        if (!Array.isArray(filter.value) && filter.value !== val) {
          return false;
        }
      }
      if (typeof filter.min !== 'undefined' && val < filter.min) {
        return false;
      }
      if (typeof filter.max !== 'undefined' && val > filter.max) {
        return false;
      }
      if (typeof filter.regexp !== 'undefined') {
        re = new RegExp(filter.regexp);
        if (!re.test(val)) {
          return false;
        }
      }
      if (typeof filter.pattern !== 'undefined') {
        re = new RegExp(filter.pattern, filter.patternFlags);
        if (!re.test(val)) {
          return false;
        }
      }
      return true;
    } else {
      return typeof val === 'undefined' || val === filter;
    }
  });
};
platform.handleActivity = function (body, res) {
  //jshint laxbreak: true
  "use strict";
  var filter;
  if (typeof body.handler !== 'undefined') {
    if (typeof queue[body.handler] === 'undefined') {
      queue[body.handler] = [];
    }
    queue[body.handler].push(body);
    filter = function (a) {
      return a.href === body.handler
          && a.name === body.name
          && platform.activityMatch(a.filters, body.data);
    };
  } else {
    filter = function (a) {
      return a.name === body.name
          && platform.activityMatch(a.filters, body);
    };
  }
  return registered.activity.filter(filter) || [];
};
module.exports = platform;
