//jshint browser: true
/*global ActivityRequestHandler, eio, Request */
/*exported Acthesis */
function Acthesis(options) {
  "use strict";
  var _options   = options;
  var handlers   = {};
  var registered = {};
  var selfUrl    = window.location.toString().split(/[\?#]/)[0];


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

  window.MozActivity = function (options) {
    var self = this;
    self.readyState = 'pending';
    self.result = null;
    self.error  = null;
    function onXhr(err, xhr) {
      var message = '', result, num;
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
        result.forEach(function (handler, i) {
          message += i + ': ' + handler.href + "\n";
        });
        num = parseInt(window.prompt(message), 10);
        if (typeof result[num] !== 'undefined') {
          options.handler = result[num].href;
          post(_options.server, options, function (err, xhr) {
            try {
              self.result = JSON.parse(xhr.responseText);
            } catch (e) {
              console.debug("INVALID response: " + xhr.responseText);
              console.debug(xhr.responseText);
              self.error = "INVALID response";
              self.onerror.call(self);
              return;
            }
            self.onsuccess.call(self);
          });
          //window.open(result[num].href);
        }
      }
    }
    post(_options.server, options, onXhr);
  };
  window.MozActivity.prototype = new Request();


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
    if (typeof handler.handleMessage === 'undefined') {
      console.error('Handler must have a handle message method');
    }
    handlers[type] = handler;
    // @TODO
    /*
    if (platform.hasPendingMessage(type)) {
      queue[type].forEach(function (message) {
        // Message is an ActivityRequestHandler
        handler(message);
      });
    }
    */
  };

  this.registerActivityHandler = function (description) {
    post(_options.server + '/register', description, function (err, xhr) {
    });
    if (typeof registered[description.name] === 'undefined') {
      registered[description.name] = [];
    }
    registered[description.name].push(description);
    //return new Request();
  };
  this.start = function () {
    if (Object.keys(registered).length === 0) {
      console.debug('Nothing to do, no handler registered');
      return;
    }
    console.debug("Starting provider");
    var socket = new eio.Socket(_options.ws);
    socket.on('open', function(){
      socket.send(JSON.stringify({type: 'providerUrl', data: selfUrl}));
      socket.on('message', function(data){
        var activities, result;
        console.log("GOT ACTIVITY", data);
        activities = JSON.parse(data);
        console.log(activities);
        if (!Array.isArray(activities)) {
          console.error("Activities should be an array");
          socket.send(JSON.stringify({type: 'error', data: "Internal error"}));
        }
        activities.forEach(function (activity) {
          var arh, onsuccess, onerror;
          if (typeof handlers[activity.name] === 'undefined') {
            console.error("No handler for " + activity.name);
            socket.send(JSON.stringify({type: 'error', data: "No handler for " + activity.name}));
          } else {
            onsuccess = function (result) {
              console.log("PROVIDER success", JSON.stringify(this));
              socket.send(JSON.stringify({type: 'success', data: result}));
            };
            onerror = function (result) {
              console.log("PROVIDER error", JSON.stringify(this));
              socket.send(JSON.stringify({type: 'error', data: result}));
            };
            arh = new ActivityRequestHandler(null, onsuccess, onerror);
            result = handlers[activity.name].handleMessage(arh);
          }
        });
      });
    });
    /*
    var hash = window.location.hash.substr(1);
    Object.keys(registered).forEach(function (key) {
      registered[key].forEach(function (description) {
        var arh, onsuccess, onerror;
        // @FIXME
        if (description.href.split('#')[1] === hash) {
          onsuccess = function (result) {
            console.log("PROVIDER success", JSON.stringify(this));
            socket.send(JSON.stringify({type: 'success', data: result}));
          };
          onerror = function (result) {
            console.log("PROVIDER error", JSON.stringify(this));
            socket.send(JSON.stringify({type: 'error', data: result}));
          };
          arh = new ActivityRequestHandler(null, onsuccess, onerror);
          handlers[description.name](arh);
        }
      });
    });
    */
    console.log(registered);
    console.log(handlers);
  };
}
