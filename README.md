Acthesis
========

Acthesis is a prosthesis (polyfill that allow every modern browser to use the Web Activity API

[Web Activity](https://developer.mozilla.org/en-US/docs/Web/API/Web_Activities) is a Web API proposed by Mozilla that “define a way for applications to delegate an activity to another (usually user-chosen) application”. It’s currently only available in Firefox Os and Firefox for Android.

For example, the API allow a Webmail to attach to a message images and files provided by other web application. My Image gallery application expose the fact that it’s able to share image files. A central registry record the actitities every Web app can handle. Then, when my Webmail needs to pick an image, it send a request to the registry. The registry answer with the list of all applications sharing images. I chose one of then, open it, select an image, and the image is sent to my webmail so it can attach it to an email.

In Firefox OS, every application register the activities it can handle via its manifesto. The OS hold the registry and manage the interactions between the apps. To emulate this behaviour on other OS and browsers, Acthesis uses a web server (written in Node.js) and a client-side library. The applications send requests to the server to register the activities they provide and get the list of available targets.

Acthesis also provide experimental and currently not documented support for [MozAlarms](https://developer.mozilla.org/en-US/docs/Web/API/Alarm_API) and [Simple Push](https://developer.mozilla.org/en-US/docs/Web/API/Simple_Push_API) API

## Install

    npm install acthesis

## Run the server

    npm run server

By default, the server will listen to port `127.0.0.1:9250`. You can make it listen to other address and port by setting the `HOST` and `PORT` environment variables : `HOST=0.0.0.0 PORT=9000 node server.js`.

You can also see some demo by running the sample server : `npm run sampleserver` and pointing your browser to `http://127.0.0.1:9250`.

## Usage

Just include the `lib/activity-client.js` library into your application and instantiate the polyfill : 
    if (typeof window.MozActivity === 'undefined') {
      new Acthesis(options, manifest);
    }

Options:
  - `server`: URL of the Acthesis server
  - `ws`: URL of the Web Socket server
  - `postMethod`: `socket` (default) or `message` (`message` is experimental, is use the [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window.postMessage) API to communicate between apps, reducing network load.)

Manifest is only needed for activity providers. The syntax is the same as in [Firefox OS manifests](https://developer.mozilla.org/en-US/docs/Web/API/Web_Activities#App_manifest_%28a.k.a._declaration_registration%29). Here’s an example :

    var manifest = {
      "activities": {
        "share": {
          "href": null,            // default to current URL
          "disposition": 'inline', // 'window' (default) or 'inline'
          "filters": {
            "type": ["image/*","image/jpeg","image/png"]
          },
          "returnValue": true
        }
      }
    }

This application provide a `share` activity accepting images. It means other applications can send it pictures.

## Samples

### Provider

A photo gallery that accept images

    if (typeof window.MozActivity === 'undefined') {
      var manifest = {
        "activities": {
          "share": {
            "href": null,
            "disposition": 'inline',
            "filters": {
              "type": ["image/*","image/jpeg","image/png"]
            },
            "returnValue": true
          }
        }
      }
      var options = {
        server: "http://acthesis.server"
      }
      new Acthesis(options, manifest);
    }
    // Call a function when application is open to trigger an activity
    // Activity payload is inside message.source.data
    // You should terminate actifuty by calling message.postResult() or message.postError()
    navigator.mozSetMessageHandler('activity', function (message) {
      console.log("Sharing: ", message.source.data);
      if (ok) {
        message.postResult(message.source.data.url);
      } else {
        message.postError("USER CANCELED");
      }
    });
    // mozSetMessageHandler is only called for activity triggered when application is open
    // The following call is mandatory to handle pending activities
    navigator.mozHasPendingMessage('activity'));

### Client

    if (typeof window.MozActivity === 'undefined') {
      new Acthesis({server: http://acthesis.server});
    }
    var activity = new MozActivity({
      name: "share",
      data: {
        url: "http://toto.org"
      }
    });
    activity.onsuccess = function() {
      console.log(this.result);
    }
    activity.onerror = function() {
      console.log(this.error);
    }

## More

 - to better understand Web Activities, see their [excellent documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Activities#App_manifest_%28a.k.a._declaration_registration%29) in MDN;
 - more samples in `sample` folder;
 - for real-world example, see [Cozy Addons](https://github.com/clochix/cozy-addons). There’s twe prototypes of addons to communicate between the Email and Files application of [CozyCloud](http://cozy.io/). This addons allow to attach a file from Files to an email, and to save email attachments into Files.

