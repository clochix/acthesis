/*global module, setTimeout */
/*exported ActivityOptions, ActivityRequestHandler, ActivityHandlerDescription,
 sendMessage, broadcastMessage, registerPage, SystemMessageCallback
*/
function ActivityOptions(name, data) {
  "use strict";
  this.name = name;
  this.data = data;
}
function ActivityRequestHandler(source, postResult, postError) {
  "use strict";
  this.source     = source;
  this.postResult = postResult;
  this.postError  = postError;
}
function ActivityHandlerDescription(name, href, disposition, returnValue, filters) {
  "use strict";
  this.name        = name;
  this.href        = href;
  this.disposition = disposition;
  this.returnValue = returnValue;
  this.filters     = filters;
}
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
function sendMessage(type, message, pageURI, manifestURI) {
}
function broadcastMessage(type, message) {
}
function registerPage(type, pageURI, manifestURI) {
}
var SystemMessageCallback = {
  handleMessage: function (message) {
  }
};


if (typeof module !== 'undefined') {
  module.exports = {
    ActivityOptions: ActivityOptions,
    ActivityRequestHandler: ActivityRequestHandler,
    ActivityHandlerDescription: ActivityHandlerDescription,
    Request: Request
  };
}
