const activeWin = require('active-win');
var x11, Getx11Property;

try {
  x11 = require("x11");
  Getx11Property = require("x11-prop").get_property;
} catch(error) {
  // In case of an error requiring x11 dependencies the user is 99.9% using Windows, so this error can be ignored
}

class AutoMinimize {
  /**
  * Creates a new AutoMinimize object
  *
  * @constructor
  */
  constructor() {
    this.initialized = false;
    this.started = false;
    this.windowsInterval = null;
    this.previousWindowTitle = "";
    this.xClient = null;
    this.xClientDisplay = null;
  }

  /**
  * Initialize either Windows or linux listener
  */
  initialize() {
    var self = this;

    return new Promise(function(resolve, reject) {
      if(os.platform() === "linux") {
        self._initializeLinux()
        .then(() => {
          return resolve();
        })
        .catch((error) => {
          return reject(error);
        });
      } else if(os.platform() === "win32") {
        self.initialized = true;
        return resolve();
      }
    });
  }

  _initializeLinux() {
    var self = this;

    return new Promise(function(resolve, reject) {
      x11.createClient(function(error, display) {
        if(error) {
          return reject(error);
        }

        self.xClientDisplay = display.screen[0].root;
        self.xClient = display.client;
        self.xClient.ChangeWindowAttributes(self.xClientDisplay, {
          eventMask: x11.eventMask.PropertyChange
        });

        self.initialized = true;
        return resolve();
      });
    });
  }

  start() {
    if(this.initialized) {
      if(os.platform() === "linux") {
        this._startLinux();
      } else if(os.platform() === "win32") {
        this._startWindows();
      }
    }
  }

  _startWindows() {
    var self = this;

    this.started = true;
    this._pollWindowTitle();
  }

  _startLinux() {
    var self = this;
    this.started = true;

    this.xClient.on("event", function(ev) {
      self._windowPropertyChangeHandler(ev);
    });

    this.xClient.on("error", function(error) {
      // xCore throws a "Bad Window" error sometimes, we catch this here
      // Without this error listener, an object of this class would simply stop working
    });
  }

  _pollWindowTitle() {
    var self = this;

    activeWin()
    .then((data) => {
      if(this._isNewWindowTitle(data.title)) {
        this.previousWindowTitle = data.title;
        this._handleWindowTitle(data.title);
      }
    })
    .catch((error) => {
      console.error(error);
    })
    .then(() => {
      if(this.started) {
        setTimeout(this._pollWindowTitle, config.get("window.poll"));
      }
    });
  }

  _isNewWindowTitle(windowTitle) {
    if(windowTitle !== this.previousWindowTitle) {
      return true;
    }

    return false;
  }

  _windowPropertyChangeHandler(ev) {
    var self = this;

    if (ev.name === "PropertyNotify") {
      this.xClient.GetAtomName(ev.atom, function(error, name) {
        if (name === "_NET_ACTIVE_WINDOW") {
          Getx11Property(self.xClient, ev.wid, ev.atom, function(error, data) {
            self._handleActiveWindowChange(data);
          });
        }
      });
    }
  }

  _handleActiveWindowChange(data) {
    var self = this;

    Getx11Property(this.xClient, data[0], "_NET_WM_NAME", function(error, windowTitle) {
      if(error) {
        return;
      }

      if(windowTitle.length > 0) {
        self._handleWindowTitle(windowTitle[0]);
      }
    });
  }

  _handleWindowTitle(windowTitle) {
    if(windowTitle === "XenonTrade") {
      app.poeFocused = false;
    } else if(windowTitle === "Path of Exile") {
      app.poeFocused = true;
      if(config.get("autoMinimize")) { gui.show(); }
    } else {
      app.poeFocused = false;
      if(config.get("autoMinimize")) { gui.minimize(); }
    }
  }
}

module.exports = AutoMinimize;