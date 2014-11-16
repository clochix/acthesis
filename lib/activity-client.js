//jshint browser: true
/*global ActivityRequestHandler */
/*exported Acthesis */
function Acthesis(options) {
  "use strict";
  var _options   = options;
  var handlers   = {};
  var registered = {};

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
    xhr.setRequestHeader("X-Requester", window.location.toString().split(/[\?#]/)[0]);
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
      result = JSON.parse(xhr.responseText);
      result.forEach(function (handler, i) {
        message += i + ': ' + handler.href + "\n";
      });
      num = parseInt(window.prompt(message), 10);
      if (typeof result[num] !== 'undefined') {
        options.handler = result[num].href;
        post(_options.server, options, function () {});
        //window.open(result[num].href);
      }
      /*
      if (err) {
        if (typeof self.onerror === 'function') {
            self.error = err;
            self.onerror.call(self);
        } else {
          console.log("Error on Activity : " + err, "error");
        }
      } else {
        if (typeof self.onsuccess === 'function') {
          self.result = JSON.parse(xhr.responseText);
          self.onsuccess.call(self);
        } else {
          console.log("Success of Activity");
        }
      }
      */
    }
    post(_options.server, options, onXhr);
  };


  // /!\ This function makes a synchroneous XHR
  navigator.mozHasPendingMessage = function (type) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', _options.server + '/pending?type=' + type, false);
    xhr.setRequestHeader("X-Requester", window.location.toString().split(/[\?#]/)[0]);
    xhr.send(null);
    if (xhr.status === 200) {
      return JSON.parse(xhr.responseText).result;
    } else {
      return false;
    }
  };

  navigator.setMessageHandler = function (type, handler) {
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
    var hash = window.location.hash.substr(1);
    Object.keys(registered).forEach(function (key) {
      registered[key].forEach(function (description) {
        var arh, onsuccess, onerror;
        // @FIXME
        if (description.href.split('#')[1] === hash) {
          onsuccess = function (result) {
            console.log(JSON.stringify(this));
          };
          onerror = function (result) {
            console.log(JSON.stringify(this));
          };
          arh = new ActivityRequestHandler(null, onsuccess, onerror);
          handlers[description.name](arh);
        }
      });
    });
  };
}
