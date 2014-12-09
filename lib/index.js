//jshint node: true
(function () {
  "use strict";
  var events     = require('events'),
      engine     = require('engine.io'),
      activity   = require('./activity-server'),
      schedule   = require('node-schedule');

  var eventEmitter = new events.EventEmitter();
  module.exports = function (options) {

    if (typeof options === 'undefined') {
      options = {};
    }

    var server = engine.attach(options.httpServer);
    server.on('connection', function(socket){
      var provider;
      function sendPending(type) {
        if (typeof provider === 'undefined') {
          console.log('No provider');
          return;
        }
        var pending = activity.getPendingMessages(provider, type, false);
        if (typeof pending !== 'undefined') {
          //console.log("Sending ", pending);
          socket.send(JSON.stringify({type: 'activity', data: pending}));
        }
      }
      socket.on('message', function(data){
        data = JSON.parse(data);
        //console.log("GOT MESSAGE", data);
        if (data.type === 'providerUrl') {
          provider = data.data.url;
        }
        if (data.type === 'success' || data.type === 'error') {
            activity.deletePendingMessages(provider);
            eventEmitter.emit('activitySent', data);
        }
        if (data.type === 'getPending') {
          sendPending(data.subtype);
        }
      });
      eventEmitter.on('activityWaiting', sendPending);
      eventEmitter.on('push', function (version) {
        socket.send(JSON.stringify({type: 'push', data: version}));
      });
      eventEmitter.on('alarm', function (alarm) {
        socket.send(JSON.stringify({type: 'alarm', data: alarm}));
      });
      socket.on('disconnect', function () {
        eventEmitter.removeListener('activityWaiting', sendPending);
      });
    });

    return function (req, res, next) {
      //jshint maxcomplexity: 20, maxstatements: 50
      var registered, timeout, pending, domRequest, path;
      path = req.path.split('/');
      switch (path.slice(0, 3).join('/')) {
        case '/activity':
          registered = activity.handleActivity(req.body, res);
          if (typeof req.body.handler !== 'undefined') {
            if (registered[0].returnValue) {
              timeout = setTimeout(function () {
                eventEmitter.emit('activitySent', {type: 'error', data: "TIMEOUT"});
              }, 30000);
              eventEmitter.once('activitySent', function (result) {
                clearTimeout(timeout);
                res.status(200).json(result);
              });
            } else {
              activity.deletePendingMessages(req.body.handler);
              res.status(200).json({type: 'success'});
            }
            eventEmitter.emit('activityWaiting', req.body.type);
          } else {
            res.status(200).json(registered);
          }
          break;
        case '/activity/pending':
          if (req.method === 'DELETE') {
            activity.deletePendingMessages(req.get('X-Requester'), path[3]);
            res.status(200).json({result: 'ok'});
          } else {
            if (typeof req.query.has !== 'undefined') {
              pending = activity.hasPendingMessage(req.get('X-Requester'), req.query.type);
            } else {
              pending = activity.getPendingMessages(req.get('X-Requester'), req.query.type, false);
            }
            res.send(JSON.stringify({result: pending}));
          }
          break;
        case '/activity/result':
          res.status(200).json({result: 'ok'}).end();
          res.end();
          eventEmitter.emit('activitySent', req.body);
          break;
        case '/activity/register':
          domRequest = activity.registerActivityHandler(req.body);
          domRequest.onsuccess = function () {
            res.status(200).json({result: 'ok'});
          };
          domRequest.onerror = function () {
            res.status(500).json({result: 'ko'});
          };
          break;
        case '/activity/unregister':
          domRequest = activity.unregisterActivityHandler(req.body);
          domRequest.onsuccess = function () {
            res.status(200).json({result: 'ok'});
          };
          domRequest.onerror = function () {
            res.status(500).json({result: 'ko'});
          };
        break;
        case '/alarm':
          if (req.method === 'GET') {
            res.status(200).json({result: 'ok', data: activity.alarm.get(req.get('X-Requester'))});
          } else if (req.method === 'POST') {
            activity.deletePendingMessages(req.get('X-Requester'), path[3]);
            var alarmId = activity.alarm.add(req.get('X-Requester'), req.body);
            req.body.id = alarmId;
            schedule.scheduleJob(new Date(req.body.date), function () {
              eventEmitter.emit('alarm', req.body);
            });
            res.status(200).json({result: 'ok', data: alarmId});
          } else {
            //@TODO
            res.status(500).json({result: 'ko'});
          }
          break;
        case '/push/register':
          var base = req.protocol + '://' + req.hostname,
              port = options.httpServer.address().port;
          if (port !== '80' && port !== '443') {
            base += ':' + port;
          }
          base += '/push/notify/';
          res.status(200).json({endpoint: activity.push.register(base)});
          break;
        case '/push/notify':
          var id = path[3],
              version = req.body.version,
              registration;
          try {
            registration = activity.push.setVersion(id, version);
            if (registration === false) {
              res.status(200).json({res: 'ko'});
            } else {
              eventEmitter.emit('push', registration);
              res.status(200).json({res: 'ok'});
            }
          } catch (e) {
            res.status(500).json({res: e.toString()});
          }
          break;
        default:
          next();
      }
    };
  };
}());
