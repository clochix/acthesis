//jshint browser: true, maxstatements: 40
/*global eio */
/*exported Acthesis */
function ActivityOptions(name, data) {
  "use strict";
  this.name = name;
  this.data = data;
}
function ActivityHandlerDescription(name, href, disposition, returnValue, filters) {
  "use strict";
  this.name        = name;
  this.href        = href || window.location.toString().split(/[\?#]/)[0];
  this.disposition = disposition;
  this.returnValue = returnValue;
  this.filters     = filters;
}
function ActivityRequestHandler(source, postResult, postError) {
  "use strict";
  if (!source instanceof ActivityOptions) {
    console.error("source should be an ActivityOptions");
  }
  this.source     = source;
  this.postResult = postResult;
  this.postError  = postError;
}

var postMethod = 'message';

function Acthesis(options, manifest) {
  "use strict";
  var self       = this,
      _options   = options,
      _manifest  = manifest,
      handlers   = {},
      registered = {},
      selfUrl    = window.location.toString().split(/[\?#]/)[0],
      _isRegistered = false;

  /**
   * XHR wrapper
   */
  function post(url, data, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onload = function (e) {
      cb(null, xhr);
    };
    xhr.onerror = function (e) {
      var err = "Request failed : " + e.target.status;
      cb(err, xhr);
    };
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.setRequestHeader("X-Requester", selfUrl);
    xhr.send(JSON.stringify(data));
  }

  // Default options values {{{
  if (_options === null || typeof _options === 'undefined') {
    _options = {};
  }
  if (typeof _options.server === 'undefined') {
    _options.server = window.location.protocol + "//" + window.location.host + "/activity";
  }
  if (typeof _options.ws === 'undefined') {
    _options.ws = "ws://" + window.location.host;
  }
  // }}}

  // Create polyfills {{{
  window.MozActivity = function (options) {
    var self = this, wait, cleared, iframe;
    self.readyState = 'pending';
    self.result = null;
    self.error  = null;
    function onResponse (response) {
      var result;
      if (iframe) {
        document.body.removeChild(iframe);
      }
      try {
        result = JSON.parse(response);
      } catch (e) {
        console.debug("[client] INVALID response: ", response);
        self.error = "INVALID response";
        self.onerror.call(self);
        return;
      }
      if (result.type === 'success') {
        self.result = result.data;
        self.onsuccess.call(self);
      } else {
        self.error = result.data;
        self.onerror.call(self);
      }
    }
    function onXhr(err, xhr) {
      var message = '', result, num, target, doSend;
      self.readyState = 'done';
      try {
        result = JSON.parse(xhr.responseText);
      } catch (e) {
        console.debug("INVALID response: " + xhr.responseText);
        console.debug(xhr.responseText);
        self.error = "INVALID response";
        self.onerror.call(self);
        return;
      }
      if (result.length === 0) {
        window.alert('No handler registered for this activity');
        self.error = 'No handler registered for this activity';
        self.onerror.call(self);
        return;
      } else {
        if (result.length > 1) {
          result.forEach(function (handler, i) {
            message += i + ': ' + (handler.fullname || handler.href) + "\n";
          });
          num = parseInt(window.prompt(message), 10);
        } else {
          num = 0;
        }
        if (typeof result[num] !== 'undefined') {
          options.handler = result[num].href;
          if (result[num].disposition === 'inline') {
            // @TODO: add some style
            iframe = document.createElement('iframe');
            iframe.src = options.handler;
            document.body.appendChild(iframe);
            target = iframe.contentWindow;
          } else {
            target = window.open(options.handler, 'acthesisTarget');
          }
          if (postMethod === 'message') {
            doSend = function () {
              target.postMessage(options, options.handler);
            };
            doSend();
            wait = window.setInterval(doSend, 100);

            window.setTimeout(function () {
              window.clearInterval(wait);
              if (cleared !== true) {
                self.error = "NO RESPONSE";
                self.onerror.call(self);
              }
              cleared = true;
            }, 10000);
          } else {
            post(_options.server, options, function (err, xhr) {
              onResponse(xhr.responseText);
            });
          }
        }
      }
    }
    if (postMethod === 'message') {
      var onMessage = function (message) {
        if (message.data === 'ack') {
          window.clearInterval(wait);
          cleared = true;
        } else {
          onResponse(message.data);
        }
        //console.log('[client]', message);
      };
      window.addEventListener("message", onMessage, false);
    }
    post(_options.server, options, onXhr);
  };

  // /!\ This function makes a synchroneous XHR
  navigator.mozHasPendingMessage = function (type) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', _options.server + '/pending?type=' + type, false);
    xhr.setRequestHeader("X-Requester", selfUrl);
    xhr.send(null);
    if (xhr.status === 200) {
      return JSON.parse(xhr.responseText).result;
    } else {
      return false;
    }
  };

  navigator.setMessageHandler = function (type, handler) {
    handlers[type] = handler;
    function getPending() {
      if (navigator.mozHasPendingMessage(type)) {
        socket.send(JSON.stringify({type: 'getPending'}));
      }
    }
    if (_isRegistered) {
      getPending();
    } else {
      var waitRegistered = window.setInterval(function () {
        if (_isRegistered) {
          window.clearInterval(waitRegistered);
          getPending();
        }
      }, 100);
    }
  };
  // }}}

  this.registerActivityHandler = function (description) {
    post(_options.server + '/register', description, function (err, xhr) {
    });
    if (typeof registered[description.name] === 'undefined') {
      registered[description.name] = [];
    }
    if (!description.disposition) {
      description.disposition = 'window';
    }
    registered[description.name].push(description);
  };

  // Register handlers
  if (_manifest && _manifest.activities) {
    Object.keys(manifest.activities).forEach(function (name) {
      var activity = manifest.activities[name];
      self.registerActivityHandler(new ActivityHandlerDescription(name, activity.href, activity.disposition, activity.returnValue, activity.filters));
    });
  }
  function handleActivity(activity) {
    var arh, onsuccess, onerror;
    if (typeof handlers[activity.name] === 'undefined') {
      console.error("[provider] No handler for " + activity.name);
      reply(JSON.stringify({type: 'error', data: "No handler for " + activity.name}));
    } else {
      onsuccess = function (result) {
        //console.log("PROVIDER success", JSON.stringify(this));
        reply(JSON.stringify({type: 'success', data: result}));
      };
      onerror = function (result) {
        //console.log("PROVIDER error", JSON.stringify(this));
        reply(JSON.stringify({type: 'error', data: result}));
      };
      //options = new ActivityOptions(activity.data.name, activity.data.data);
      arh = new ActivityRequestHandler(activity.data, onsuccess, onerror);
      handlers[activity.name](arh);
    }
  }
  if (Object.keys(registered).length > 0) {
    var reply, clientMessage;
    if (postMethod === 'message') {
      reply = function (response) {
        clientMessage.source.postMessage(response, clientMessage.origin);
      };
      window.addEventListener("message", function (message) {
        clientMessage = message;
        //console.log('[provider]', message);
        reply('ack');
        handleActivity(message.data);
      }, false);
    } else {
      var socket = new eio.Socket(_options.ws);
      reply = function (response) {
        socket.send(response);
      };
      socket.on('open', function(){
        reply(JSON.stringify({type: 'providerUrl', data: {url: selfUrl}}));
        _isRegistered = true;
        socket.on('message', function(message){
          var activities;
          activities = JSON.parse(message);
          if (!Array.isArray(activities)) {
            console.error("[provider] Activities should be an array");
            reply(JSON.stringify({type: 'error', data: "Internal error"}));
          }
          activities.forEach(handleActivity);
        });
      });
    }
  }
}
