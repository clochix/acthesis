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

/**
 * Create modal window
 */
function modal(content) {
  "use strict";
  [document.children[0], document.body].forEach(function (e) {
    e.style.height  = "100%";
    e.style.width   = "100%";
    e.style.padding = "0";
    e.style.margin  = "0";
  });
  var mod  = document.createElement('div'),
      cell = document.createElement('div'),
      overlay = document.createElement('div');
  mod.setAttribute('style', 'display: inline-block; max-width: 50%; background: white');
  cell.setAttribute('style', 'display:table-cell; vertical-align:middle; text-align:center');
  overlay.setAttribute('style', 'position: fixed; top: 0; left: 0;display:table; width: 100%; height: 100%; background: rgba(0,0,0,.5)');
  if (content instanceof Element) {
    mod.appendChild(content);
  } else {
    mod.innerHTML = content;
  }
  cell.appendChild(mod);
  overlay.appendChild(cell);
  document.body.appendChild(overlay);
  return function () {
    document.body.removeChild(overlay);
  };
}

function Acthesis(options, manifest) {
  "use strict";
  var self       = this,
      _options   = options,
      _manifest  = manifest,
      handlers   = {},
      registered = {},
      selfUrl    = window.location.toString().split(/[\?#]/)[0],
      _isRegistered = false;

  registered = {
    activity: [],
    alarm: [],
    notification: [],
    push: []
  };
  /**
   * XHR wrapper
   */
  function get(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function (e) {
      if (typeof cb === 'function') {
        cb(null, xhr);
      }
    };
    xhr.onerror = function (e) {
      var err = "Request failed : " + e.target.status;
      if (typeof cb === 'function') {
        cb(err, xhr);
      }
    };
    xhr.setRequestHeader("X-Requester", selfUrl);
    xhr.send();
  }
  function post(url, data, cb) {
    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onload = function (e) {
      if (typeof cb === 'function') {
        cb(null, xhr);
      }
    };
    xhr.onerror = function (e) {
      var err = "Request failed : " + e.target.status;
      if (typeof cb === 'function') {
        cb(err, xhr);
      }
    };
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.setRequestHeader("X-Requester", selfUrl);
    xhr.send(data);
  }

  // Default options values {{{
  if (_options === null || typeof _options === 'undefined') {
    _options = {};
  }
  if (typeof _options.server === 'undefined') {
    _options.server = window.location.protocol + "//" + window.location.host;
  }
  if (typeof _options.ws === 'undefined') {
    _options.ws = "ws://" + window.location.host;
  }
  // }}}

  // Create polyfills {{{
  function Request(options) {
    var self = this;
    self.readyState = 'pending';
    self.result = null;
    self.error  = null;
  }
  window.MozActivity = function (options) {
    Request.call(this, options);
    var self = this, iframe, iframeContainer; //wait, cleared;
    options.id   = uuid();
    options.type = 'activity';
    function onResponse (response) {
      var result;
      if (self.readyState === 'done') {
        return;
      }
      self.readyState = 'done';
      if (iframeContainer) {
        iframeContainer();
      }
      try {
        if (typeof response === 'string') {
          result = JSON.parse(response);
        } else {
          result = response;
        }
      } catch (e) {
        console.debug("[client] INVALID response: ", response);
        self.error = "INVALID response";
        self.onerror.call(self);
        return;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('DELETE', _options.server + '/activity/pending/' + options.id, false);
      xhr.setRequestHeader("X-Requester", options.handler);
      xhr.send(null);
      if (result.type === 'success') {
        self.result = result.data;
        self.onsuccess.call(self);
      } else {
        self.error = result.data;
        self.onerror.call(self);
      }
    }
    function onXhr(err, xhr) {
      var result, target, doSend;
      function send(num) {
        if (typeof result[num] !== 'undefined') {
          options.handler = result[num].href;
          if (result[num].disposition === 'inline') {
            // @TODO: add some style
            iframe = document.createElement('iframe');
            iframe.src = options.handler;
            iframeContainer = modal(iframe);
            target = iframe.contentWindow;
          } else {
            target = window.open(options.handler, 'acthesisTarget');
          }
          // Send message with postMessage and via server with XHR
          // postMessage
          doSend = function () {
            target.postMessage(options, options.handler);
          };
          doSend();
          // Try until response {
          /*
          wait = window.setInterval(doSend, 100);
          window.setTimeout(function () {
            window.clearInterval(wait);
            if (cleared !== true) {
              onResponse({type: 'error', data: 'NO RESPONSE'});
            }
            cleared = true;
          }, 10000);
          */
          // }
          // XHR
          post(_options.server + '/activity', options, function (err, xhr) {
            onResponse(xhr.responseText);
          });
        }
      }
      try {
        result = JSON.parse(xhr.responseText);
      } catch (e) {
        console.debug("INVALID response: " + xhr.responseText);
        console.debug(xhr.responseText);
        onResponse({type: 'error', data: 'INVALID response'});
        return;
      }
      if (result.length === 0) {
        self.readyState = 'done';
        window.alert('No handler registered for this activity');
        onResponse({type: 'error', data: 'No handler registered for this activity'});
        return;
      } else {
        if (result.length > 1) {
          var form = document.createElement('form'),
              win;
          result.forEach(function (handler, i) {
            var button = document.createElement('button');
            button.innerHTML = handler.fullname || handler.href;
            button.style = "display: block; width: 100%;border-width: 0px;";
            button.onclick = function () {
              send(i);
              win();
            };
            form.appendChild(button);
          });
          var button = document.createElement('button');
          button.innerHTML = 'Cancel';
          button.style = "display: block; width: 100%;border-width: 0px;";
          button.onclick = function () {
            send();
            win();
          };
          form.appendChild(button);
          win = modal(form);
        } else {
          send(0);
        }
      }
    }
    var onMessage = function (message) {
      //if (message.data === 'ack') {
        //window.clearInterval(wait);
        //cleared = true;
      //} else {
      onResponse(message.data);
      //}
      //console.log('[client]', message);
    };
    window.addEventListener("message", onMessage, false);
    post(_options.server + '/activity', options, onXhr);
  };

  // /!\ This function makes a synchroneous XHR
  navigator.mozHasPendingMessage = function (type) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', _options.server + '/activity/pending?has=true&type=' + type, false);
    xhr.setRequestHeader("X-Requester", selfUrl);
    xhr.send(null);
    if (xhr.status === 200) {
      return JSON.parse(xhr.responseText).result;
    } else {
      return false;
    }
  };

  navigator.mozSetMessageHandler = function (type, handler) {
    handlers[type] = handler;
    function getPending(type) {
      if (_options.postMethod === 'message') {
        var xhr = new XMLHttpRequest();
        xhr.onload = function (e) {
          var activities = JSON.parse(xhr.responseText).result;
          activities.forEach(handleActivity);
        };
        xhr.onerror = function (e) {
          //@TODO
        };
        xhr.open('GET', _options.server + '/activity/pending?type=' + type, false);
        xhr.setRequestHeader("X-Requester", selfUrl);
        xhr.send(null);
      } else {
        if (navigator.mozHasPendingMessage(type)) {
          socket.send(JSON.stringify({type: 'getPending', subtype: type}));
        }
      }
    }
    if (_options.postMethod === 'message' || _isRegistered) {
      getPending(type);
    } else {
      var waitRegistered = window.setInterval(function () {
        if (_isRegistered) {
          window.clearInterval(waitRegistered);
          getPending(type);
        }
      }, 100);
    }
  };

  // {{ push
  // @See https://developer.mozilla.org/en-US/docs/Web/API/Simple_Push_API
  (function () {
    function PushRegistration(url) {
      this.pushEndpoint = url;
      this.version = undefined;
    }
    var endpoints = [];
    navigator.push = {
      register: function () {
        var req = new Request();
        get(_options.server + '/push/register', function (err, xhr) {
          var endpoint = JSON.parse(xhr.responseText).endpoint;
          endpoints.push(new PushRegistration(endpoint));
          req.result = endpoint;
          req.onsuccess();
        });
        return req;
      },
      unregister: function (endPoint) {
        var req = new Request();
        /*
        setTimeout(function () {
          var res;
          endpoints = endpoints.filter(function (e) {
            if (e.pushEndpoint === endPoint) {
              res = e;
              return false;
            } else {
              return true;
            }
          });
          req.result = res;
          delete endpoints[endPoint];
          req.onsuccess();
        }, 1000);
        */
        return req;
      },
      registrations: function () {
        var req = new Request();
        setTimeout(function () {
          req.result = endpoints;
          req.onsuccess();
        }, 1000);
        return req;
      }
    };
  }());
  // }}
  // }}}

  this.registerActivityHandler = function (description) {
    description.fullname = document.title;
    post(_options.server + '/activity/register', description, function (err, xhr) {
    });
    if (!description.disposition) {
      description.disposition = 'window';
    }
    registered.activity.push(description);
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
    if (typeof handlers[activity.type] === 'undefined') {
      console.error("[provider] No handler for " + activity.type);
      console.log(handlers);
      reply(JSON.stringify({type: 'error', data: "No handler for " + activity.type}));
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
      handlers[activity.type](arh);
    }
  }
  if (Object.keys(registered).length > 0) {
    var reply, clientMessage;
    if (_options.postMethod === 'message') {
      reply = function (response) {
        if (typeof clientMessage === 'undefined') {
          post(_options.server + '/activity/result', response);
        } else {
          clientMessage.source.postMessage(response, clientMessage.origin);
        }
      };
      window.addEventListener("message", function (message) {
        clientMessage = message;
        //console.log('[provider]', message);
        //reply('ack');
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
          message = JSON.parse(message);
          switch (message.type) {
          case 'activity':
            activities = message.data;
            if (!Array.isArray(activities)) {
              console.error("[provider] Activities should be an array");
              reply(JSON.stringify({type: 'error', data: "Internal error"}));
            }
            activities.forEach(handleActivity);
            break;
          case 'push':
            handlers.push(message.data);
            break;
          }
        });
      });
    }
  }
}
