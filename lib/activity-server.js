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
  alarm: {},
  notification: [],
  push: {}
};

// ES6 Polyfills {{{
// Array.findIndex @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function (predicate) {
    //jshint bitwise: false
    "use strict";
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this),
        length = list.length >>> 0,
        thisArg = arguments[1],
        value, i;

    for (i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}
// }}}

// @src http://blog.snowfinch.net/post/3254029029/uuid-v4-js
// @licence Public domain
function uuid() {
  "use strict";
  /*jshint bitwise: false */
  var id = "", i, random;
  for (i = 0; i < 32; i++) {
    random = Math.random() * 16 | 0;
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      id += "-";
    }
    id += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
  }
  return id;
}

function Request(options) {
  "use strict";
  var self = this;
  self.readyState = 'pending';
  self.result = null;
  self.error  = null;
  function done(err, res) {
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
  return queue[handler].some(function (e) {
    return e.type === type;
  });
};
platform.getPendingMessages = function (requester, type, del) {
  "use strict";
  if (!Array.isArray(queue[requester])) {
    return [];
  }
  var res = queue[requester].filter(function (e) {
    return e.type === type;
  });
  if (del === true) {
    queue[requester] = queue[requester].filter(function (e) {
      return e.type !== type;
    });
  }
  return res;
};
platform.deletePendingMessages = function (requester, id) {
  "use strict";
  if (!Array.isArray(queue[requester]) || queue[requester].length === 0) {
    console.log("No pending message to delete", requester, queue);
    return false;
  }
  queue[requester] = queue[requester].filter(function (e) {
    return e.id !== id;
  });
  return true;
};
platform.registerActivityHandler = function (description) {
  "use strict";
  if (!description.disposition) {
    description.disposition = 'window';
  }
  if (typeof registered.activity === 'undefined') {
    registered.activity = [];
  }
  var idx = registered.activity.findIndex(function (e) {
    return e.href === description.href && e.name === description.name;
  });
  if (idx === -1) {
    registered.activity.push(description);
  } else {
    registered.activity[idx] = description;
  }
  fs.writeFileSync(configPath, JSON.stringify(registered, null, 2));
  return new Request();
};
platform.unregisterActivityHandler = function (description) {
  "use strict";
  registered.activity = registered.activity.filter(function (e) {
    return e.href !== description.href;
  });
  fs.writeFileSync(configPath, JSON.stringify(registered, null, 2));
  return new Request();
};

platform.activityMatch = function (filters, activity) {
  "use strict";
  if (typeof filters === 'undefined') {
    return true;
  }
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
platform.handleActivity = function (body) {
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
      // If no body name, get all registered activities
      return (typeof body.name === 'undefined' ||
              (a.name === body.name && platform.activityMatch(a.filters, body)));
    };
  }
  return registered.activity.filter(filter) || [];
};
// Alarm {{
platform.alarm = {
  get: function (requester) {
    "use strict";
    return registered.alarm[requester] || [];
  },
  add: function (requester, alarm) {
    "use strict";
    if (typeof registered.alarm === 'undefined') {
      registered.alarm = {};
    }
    if (typeof registered.alarm[requester] === 'undefined') {
      registered.alarm[requester] = [];
    }
    alarm.id = uuid();
    registered.alarm[requester].push(alarm);
    return alarm.id;
  },
  remove: function (requester, id) {
    "use strict";
    if (!Array.isArray(registered.alarm[requester]) || registered.alarm[requester].length === 0) {
      console.log("No alarm to delete", requester, queue);
      return false;
    }
    registered.alarm[requester] = registered.alarm[requester].filter(function (e) {
      return e.id !== id;
    });
    return true;
  }
};
// }}
// Push {{
// @See https://developer.mozilla.org/en-US/docs/Web/API/Simple_Push_API
platform.push = {
  register: function (base) {
    "use strict";
    var id = uuid(),
        registration;
    registration = {
      pushEndpoint: base + id,
      version: 0
    };
    if (typeof registered.push === 'undefined') {
      registered.push = {};
    }
    registered.push[id] = registration;
    //fs.writeFileSync(configPath, JSON.stringify(registered, null, 2));
    return registration.pushEndpoint;
  },
  unregister: function (endPoint) {
    "use strict";
    var id = endPoint.split('/').pop(),
        registration = registered.push[id];
    delete registered.push[id];
    return registration;
    //fs.writeFileSync(configPath, JSON.stringify(registered, null, 2));
  },
  setVersion: function (id, version) {
    "use strict";
    var registration = registered.push[id];
    if (typeof registration === 'undefined') {
      throw 'Unknown endpoint';
    }
    if (registration.version < version) {
      registration.version = version;
      //fs.writeFileSync(configPath, JSON.stringify(registered, null, 2));
      return registration;
    } else {
      return false;
    }
  },
  registrations: function () {
    "use strict";
  }
};
platform.debug = function () {
  "use strict";
  return {
    platform: platform,
    registered: registered,
    queue: queue
  };
};
// }}
module.exports = platform;
