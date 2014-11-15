//jshint browser: true
/*exported Acthesis */
function Acthesis(options) {
  "use strict";
  var _options = options;

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
    xhr.send(JSON.stringify(data));
  }

  window.MozActivity = function (options) {
    var self = this;
    self.readyState = 'pending';
    self.result = null;
    self.error  = null;
    function onXhr(err, xhr) {
      self.readyState = 'done';
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
    }
    post(_options.server, options, onXhr);
  };


  // /!\ This function makes a synchroneous XHR
  navigator.mozHasPendingMessage = function (type) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', _options.server + '/pending', false);
    xhr.send(null);
    if (xhr.status === 200) {
      console.log(JSON.parse(xhr.responseText));
    } else {
      console.log("Error");
    }
  };

  this.registerActivityHandler = function (description) {
    post(_options.server + '/register', description, function (err, xhr) {
    });
  };
}
