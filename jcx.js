var JCX = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/@capacitor/core/dist/index.js
  var createCapacitorPlatforms, initPlatforms, CapacitorPlatforms, addPlatform, setPlatform, ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, Plugins, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp;
  var init_dist = __esm({
    "node_modules/@capacitor/core/dist/index.js"() {
      createCapacitorPlatforms = (win) => {
        const defaultPlatformMap = /* @__PURE__ */ new Map();
        defaultPlatformMap.set("web", { name: "web" });
        const capPlatforms = win.CapacitorPlatforms || {
          currentPlatform: { name: "web" },
          platforms: defaultPlatformMap
        };
        const addPlatform2 = (name, platform) => {
          capPlatforms.platforms.set(name, platform);
        };
        const setPlatform2 = (name) => {
          if (capPlatforms.platforms.has(name)) {
            capPlatforms.currentPlatform = capPlatforms.platforms.get(name);
          }
        };
        capPlatforms.addPlatform = addPlatform2;
        capPlatforms.setPlatform = setPlatform2;
        return capPlatforms;
      };
      initPlatforms = (win) => win.CapacitorPlatforms = createCapacitorPlatforms(win);
      CapacitorPlatforms = /* @__PURE__ */ initPlatforms(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      addPlatform = CapacitorPlatforms.addPlatform;
      setPlatform = CapacitorPlatforms.setPlatform;
      (function(ExceptionCode2) {
        ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
        ExceptionCode2["Unavailable"] = "UNAVAILABLE";
      })(ExceptionCode || (ExceptionCode = {}));
      CapacitorException = class extends Error {
        constructor(message, code, data) {
          super(message);
          this.message = message;
          this.code = code;
          this.data = data;
        }
      };
      getPlatformId = (win) => {
        var _a, _b;
        if (win === null || win === void 0 ? void 0 : win.androidBridge) {
          return "android";
        } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
          return "ios";
        } else {
          return "web";
        }
      };
      createCapacitor = (win) => {
        var _a, _b, _c, _d, _e;
        const capCustomPlatform = win.CapacitorCustomPlatform || null;
        const cap = win.Capacitor || {};
        const Plugins2 = cap.Plugins = cap.Plugins || {};
        const capPlatforms = win.CapacitorPlatforms;
        const defaultGetPlatform = () => {
          return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
        };
        const getPlatform = ((_a = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _a === void 0 ? void 0 : _a.getPlatform) || defaultGetPlatform;
        const defaultIsNativePlatform = () => getPlatform() !== "web";
        const isNativePlatform = ((_b = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _b === void 0 ? void 0 : _b.isNativePlatform) || defaultIsNativePlatform;
        const defaultIsPluginAvailable = (pluginName) => {
          const plugin = registeredPlugins.get(pluginName);
          if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
            return true;
          }
          if (getPluginHeader(pluginName)) {
            return true;
          }
          return false;
        };
        const isPluginAvailable = ((_c = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _c === void 0 ? void 0 : _c.isPluginAvailable) || defaultIsPluginAvailable;
        const defaultGetPluginHeader = (pluginName) => {
          var _a2;
          return (_a2 = cap.PluginHeaders) === null || _a2 === void 0 ? void 0 : _a2.find((h) => h.name === pluginName);
        };
        const getPluginHeader = ((_d = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _d === void 0 ? void 0 : _d.getPluginHeader) || defaultGetPluginHeader;
        const handleError = (err) => win.console.error(err);
        const pluginMethodNoop = (_target, prop, pluginName) => {
          return Promise.reject(`${pluginName} does not have an implementation of "${prop}".`);
        };
        const registeredPlugins = /* @__PURE__ */ new Map();
        const defaultRegisterPlugin = (pluginName, jsImplementations = {}) => {
          const registeredPlugin = registeredPlugins.get(pluginName);
          if (registeredPlugin) {
            console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
            return registeredPlugin.proxy;
          }
          const platform = getPlatform();
          const pluginHeader = getPluginHeader(pluginName);
          let jsImplementation;
          const loadPluginImplementation = async () => {
            if (!jsImplementation && platform in jsImplementations) {
              jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
            } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
              jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
            }
            return jsImplementation;
          };
          const createPluginMethod = (impl, prop) => {
            var _a2, _b2;
            if (pluginHeader) {
              const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
              if (methodHeader) {
                if (methodHeader.rtype === "promise") {
                  return (options) => cap.nativePromise(pluginName, prop.toString(), options);
                } else {
                  return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
                }
              } else if (impl) {
                return (_a2 = impl[prop]) === null || _a2 === void 0 ? void 0 : _a2.bind(impl);
              }
            } else if (impl) {
              return (_b2 = impl[prop]) === null || _b2 === void 0 ? void 0 : _b2.bind(impl);
            } else {
              throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          };
          const createPluginMethodWrapper = (prop) => {
            let remove;
            const wrapper = (...args) => {
              const p = loadPluginImplementation().then((impl) => {
                const fn = createPluginMethod(impl, prop);
                if (fn) {
                  const p2 = fn(...args);
                  remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                  return p2;
                } else {
                  throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
                }
              });
              if (prop === "addListener") {
                p.remove = async () => remove();
              }
              return p;
            };
            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
            Object.defineProperty(wrapper, "name", {
              value: prop,
              writable: false,
              configurable: false
            });
            return wrapper;
          };
          const addListener = createPluginMethodWrapper("addListener");
          const removeListener = createPluginMethodWrapper("removeListener");
          const addListenerNative = (eventName, callback) => {
            const call = addListener({ eventName }, callback);
            const remove = async () => {
              const callbackId = await call;
              removeListener({
                eventName,
                callbackId
              }, callback);
            };
            const p = new Promise((resolve) => call.then(() => resolve({ remove })));
            p.remove = async () => {
              console.warn(`Using addListener() without 'await' is deprecated.`);
              await remove();
            };
            return p;
          };
          const proxy = new Proxy({}, {
            get(_, prop) {
              switch (prop) {
                // https://github.com/facebook/react/issues/20030
                case "$$typeof":
                  return void 0;
                case "toJSON":
                  return () => ({});
                case "addListener":
                  return pluginHeader ? addListenerNative : addListener;
                case "removeListener":
                  return removeListener;
                default:
                  return createPluginMethodWrapper(prop);
              }
            }
          });
          Plugins2[pluginName] = proxy;
          registeredPlugins.set(pluginName, {
            name: pluginName,
            proxy,
            platforms: /* @__PURE__ */ new Set([
              ...Object.keys(jsImplementations),
              ...pluginHeader ? [platform] : []
            ])
          });
          return proxy;
        };
        const registerPlugin2 = ((_e = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _e === void 0 ? void 0 : _e.registerPlugin) || defaultRegisterPlugin;
        if (!cap.convertFileSrc) {
          cap.convertFileSrc = (filePath) => filePath;
        }
        cap.getPlatform = getPlatform;
        cap.handleError = handleError;
        cap.isNativePlatform = isNativePlatform;
        cap.isPluginAvailable = isPluginAvailable;
        cap.pluginMethodNoop = pluginMethodNoop;
        cap.registerPlugin = registerPlugin2;
        cap.Exception = CapacitorException;
        cap.DEBUG = !!cap.DEBUG;
        cap.isLoggingEnabled = !!cap.isLoggingEnabled;
        cap.platform = cap.getPlatform();
        cap.isNative = cap.isNativePlatform();
        return cap;
      };
      initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
      Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      registerPlugin = Capacitor.registerPlugin;
      Plugins = Capacitor.Plugins;
      WebPlugin = class {
        constructor(config) {
          this.listeners = {};
          this.retainedEventArguments = {};
          this.windowListeners = {};
          if (config) {
            console.warn(`Capacitor WebPlugin "${config.name}" config object was deprecated in v3 and will be removed in v4.`);
            this.config = config;
          }
        }
        addListener(eventName, listenerFunc) {
          let firstListener = false;
          const listeners = this.listeners[eventName];
          if (!listeners) {
            this.listeners[eventName] = [];
            firstListener = true;
          }
          this.listeners[eventName].push(listenerFunc);
          const windowListener = this.windowListeners[eventName];
          if (windowListener && !windowListener.registered) {
            this.addWindowListener(windowListener);
          }
          if (firstListener) {
            this.sendRetainedArgumentsForEvent(eventName);
          }
          const remove = async () => this.removeListener(eventName, listenerFunc);
          const p = Promise.resolve({ remove });
          return p;
        }
        async removeAllListeners() {
          this.listeners = {};
          for (const listener in this.windowListeners) {
            this.removeWindowListener(this.windowListeners[listener]);
          }
          this.windowListeners = {};
        }
        notifyListeners(eventName, data, retainUntilConsumed) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            if (retainUntilConsumed) {
              let args = this.retainedEventArguments[eventName];
              if (!args) {
                args = [];
              }
              args.push(data);
              this.retainedEventArguments[eventName] = args;
            }
            return;
          }
          listeners.forEach((listener) => listener(data));
        }
        hasListeners(eventName) {
          return !!this.listeners[eventName].length;
        }
        registerWindowListener(windowEventName, pluginEventName) {
          this.windowListeners[pluginEventName] = {
            registered: false,
            windowEventName,
            pluginEventName,
            handler: (event) => {
              this.notifyListeners(pluginEventName, event);
            }
          };
        }
        unimplemented(msg = "not implemented") {
          return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
        }
        unavailable(msg = "not available") {
          return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
        }
        async removeListener(eventName, listenerFunc) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            return;
          }
          const index = listeners.indexOf(listenerFunc);
          this.listeners[eventName].splice(index, 1);
          if (!this.listeners[eventName].length) {
            this.removeWindowListener(this.windowListeners[eventName]);
          }
        }
        addWindowListener(handle) {
          window.addEventListener(handle.windowEventName, handle.handler);
          handle.registered = true;
        }
        removeWindowListener(handle) {
          if (!handle) {
            return;
          }
          window.removeEventListener(handle.windowEventName, handle.handler);
          handle.registered = false;
        }
        sendRetainedArgumentsForEvent(eventName) {
          const args = this.retainedEventArguments[eventName];
          if (!args) {
            return;
          }
          delete this.retainedEventArguments[eventName];
          args.forEach((arg) => {
            this.notifyListeners(eventName, arg);
          });
        }
      };
      encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
      CapacitorCookiesPluginWeb = class extends WebPlugin {
        async getCookies() {
          const cookies = document.cookie;
          const cookieMap = {};
          cookies.split(";").forEach((cookie) => {
            if (cookie.length <= 0)
              return;
            let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
            key = decode(key).trim();
            value = decode(value).trim();
            cookieMap[key] = value;
          });
          return cookieMap;
        }
        async setCookie(options) {
          try {
            const encodedKey = encode(options.key);
            const encodedValue = encode(options.value);
            const expires = `; expires=${(options.expires || "").replace("expires=", "")}`;
            const path = (options.path || "/").replace("path=", "");
            const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
            document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async deleteCookie(options) {
          try {
            document.cookie = `${options.key}=; Max-Age=0`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearCookies() {
          try {
            const cookies = document.cookie.split(";") || [];
            for (const cookie of cookies) {
              document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
            }
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearAllCookies() {
          try {
            await this.clearCookies();
          } catch (error) {
            return Promise.reject(error);
          }
        }
      };
      CapacitorCookies = registerPlugin("CapacitorCookies", {
        web: () => new CapacitorCookiesPluginWeb()
      });
      readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
      normalizeHttpHeaders = (headers = {}) => {
        const originalKeys = Object.keys(headers);
        const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
        const normalized = loweredKeys.reduce((acc, key, index) => {
          acc[key] = headers[originalKeys[index]];
          return acc;
        }, {});
        return normalized;
      };
      buildUrlParams = (params, shouldEncode = true) => {
        if (!params)
          return null;
        const output = Object.entries(params).reduce((accumulator, entry) => {
          const [key, value] = entry;
          let encodedValue;
          let item;
          if (Array.isArray(value)) {
            item = "";
            value.forEach((str) => {
              encodedValue = shouldEncode ? encodeURIComponent(str) : str;
              item += `${key}=${encodedValue}&`;
            });
            item.slice(0, -1);
          } else {
            encodedValue = shouldEncode ? encodeURIComponent(value) : value;
            item = `${key}=${encodedValue}`;
          }
          return `${accumulator}&${item}`;
        }, "");
        return output.substr(1);
      };
      buildRequestInit = (options, extra = {}) => {
        const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
        const headers = normalizeHttpHeaders(options.headers);
        const type = headers["content-type"] || "";
        if (typeof options.data === "string") {
          output.body = options.data;
        } else if (type.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(options.data || {})) {
            params.set(key, value);
          }
          output.body = params.toString();
        } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
          const form = new FormData();
          if (options.data instanceof FormData) {
            options.data.forEach((value, key) => {
              form.append(key, value);
            });
          } else {
            for (const key of Object.keys(options.data)) {
              form.append(key, options.data[key]);
            }
          }
          output.body = form;
          const headers2 = new Headers(output.headers);
          headers2.delete("content-type");
          output.headers = headers2;
        } else if (type.includes("application/json") || typeof options.data === "object") {
          output.body = JSON.stringify(options.data);
        }
        return output;
      };
      CapacitorHttpPluginWeb = class extends WebPlugin {
        /**
         * Perform an Http request given a set of options
         * @param options Options to build the HTTP request
         */
        async request(options) {
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
          const url = urlParams ? `${options.url}?${urlParams}` : options.url;
          const response = await fetch(url, requestInit);
          const contentType = response.headers.get("content-type") || "";
          let { responseType = "text" } = response.ok ? options : {};
          if (contentType.includes("application/json")) {
            responseType = "json";
          }
          let data;
          let blob;
          switch (responseType) {
            case "arraybuffer":
            case "blob":
              blob = await response.blob();
              data = await readBlobAsBase64(blob);
              break;
            case "json":
              data = await response.json();
              break;
            case "document":
            case "text":
            default:
              data = await response.text();
          }
          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return {
            data,
            headers,
            status: response.status,
            url: response.url
          };
        }
        /**
         * Perform an Http GET request given a set of options
         * @param options Options to build the HTTP request
         */
        async get(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
        }
        /**
         * Perform an Http POST request given a set of options
         * @param options Options to build the HTTP request
         */
        async post(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
        }
        /**
         * Perform an Http PUT request given a set of options
         * @param options Options to build the HTTP request
         */
        async put(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
        }
        /**
         * Perform an Http PATCH request given a set of options
         * @param options Options to build the HTTP request
         */
        async patch(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
        }
        /**
         * Perform an Http DELETE request given a set of options
         * @param options Options to build the HTTP request
         */
        async delete(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
        }
      };
      CapacitorHttp = registerPlugin("CapacitorHttp", {
        web: () => new CapacitorHttpPluginWeb()
      });
    }
  });

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/conversion.js
  function numbersToDataView(value) {
    return new DataView(Uint8Array.from(value).buffer);
  }
  function dataViewToNumbers(value) {
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  function numberToUUID(value) {
    return `0000${value.toString(16).padStart(4, "0")}-0000-1000-8000-00805f9b34fb`;
  }
  function hexStringToDataView(hex) {
    const bin = [];
    let i, c, isEmpty = 1, buffer = 0;
    for (i = 0; i < hex.length; i++) {
      c = hex.charCodeAt(i);
      if (c > 47 && c < 58 || c > 64 && c < 71 || c > 96 && c < 103) {
        buffer = buffer << 4 ^ (c > 64 ? c + 9 : c) & 15;
        if (isEmpty ^= 1) {
          bin.push(buffer & 255);
        }
      }
    }
    return numbersToDataView(bin);
  }
  function dataViewToHexString(value) {
    return dataViewToNumbers(value).map((n) => {
      let s = n.toString(16);
      if (s.length == 1) {
        s = "0" + s;
      }
      return s;
    }).join(" ");
  }
  function webUUIDToString(uuid) {
    if (typeof uuid === "string") {
      return uuid;
    } else if (typeof uuid === "number") {
      return numberToUUID(uuid);
    } else {
      throw new Error("Invalid UUID");
    }
  }
  function mapToObject(map) {
    const obj = {};
    if (!map) {
      return void 0;
    }
    map.forEach((value, key) => {
      obj[key.toString()] = value;
    });
    return obj;
  }
  var init_conversion = __esm({
    "node_modules/@capacitor-community/bluetooth-le/dist/esm/conversion.js"() {
    }
  });

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/timeout.js
  async function runWithTimeout(promise, time, exception) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(exception), time);
      })
    ]).finally(() => clearTimeout(timer));
  }
  var init_timeout = __esm({
    "node_modules/@capacitor-community/bluetooth-le/dist/esm/timeout.js"() {
    }
  });

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/web.js
  var web_exports = {};
  __export(web_exports, {
    BluetoothLeWeb: () => BluetoothLeWeb
  });
  var BluetoothLeWeb;
  var init_web = __esm({
    "node_modules/@capacitor-community/bluetooth-le/dist/esm/web.js"() {
      init_dist();
      init_conversion();
      init_timeout();
      BluetoothLeWeb = class extends WebPlugin {
        constructor() {
          super(...arguments);
          this.deviceMap = /* @__PURE__ */ new Map();
          this.discoveredDevices = /* @__PURE__ */ new Map();
          this.scan = null;
          this.DEFAULT_CONNECTION_TIMEOUT = 1e4;
          this.onAdvertisementReceivedCallback = this.onAdvertisementReceived.bind(this);
          this.onDisconnectedCallback = this.onDisconnected.bind(this);
          this.onCharacteristicValueChangedCallback = this.onCharacteristicValueChanged.bind(this);
        }
        async initialize() {
          if (typeof navigator === "undefined" || !navigator.bluetooth) {
            throw this.unavailable("Web Bluetooth API not available in this browser.");
          }
          const isAvailable = await navigator.bluetooth.getAvailability();
          if (!isAvailable) {
            throw this.unavailable("No Bluetooth radio available.");
          }
        }
        async isEnabled() {
          return { value: true };
        }
        async requestEnable() {
          throw this.unavailable("requestEnable is not available on web.");
        }
        async enable() {
          throw this.unavailable("enable is not available on web.");
        }
        async disable() {
          throw this.unavailable("disable is not available on web.");
        }
        async startEnabledNotifications() {
        }
        async stopEnabledNotifications() {
        }
        async isLocationEnabled() {
          throw this.unavailable("isLocationEnabled is not available on web.");
        }
        async openLocationSettings() {
          throw this.unavailable("openLocationSettings is not available on web.");
        }
        async openBluetoothSettings() {
          throw this.unavailable("openBluetoothSettings is not available on web.");
        }
        async openAppSettings() {
          throw this.unavailable("openAppSettings is not available on web.");
        }
        async setDisplayStrings() {
        }
        async requestDevice(options) {
          const filters = this.getFilters(options);
          const device = await navigator.bluetooth.requestDevice({
            filters: filters.length ? filters : void 0,
            optionalServices: options === null || options === void 0 ? void 0 : options.optionalServices,
            acceptAllDevices: filters.length === 0
          });
          this.deviceMap.set(device.id, device);
          const bleDevice = this.getBleDevice(device);
          return bleDevice;
        }
        async requestLEScan(options) {
          this.requestBleDeviceOptions = options;
          const filters = this.getFilters(options);
          await this.stopLEScan();
          this.discoveredDevices = /* @__PURE__ */ new Map();
          navigator.bluetooth.removeEventListener("advertisementreceived", this.onAdvertisementReceivedCallback);
          navigator.bluetooth.addEventListener("advertisementreceived", this.onAdvertisementReceivedCallback);
          this.scan = await navigator.bluetooth.requestLEScan({
            filters: filters.length ? filters : void 0,
            acceptAllAdvertisements: filters.length === 0,
            keepRepeatedDevices: options === null || options === void 0 ? void 0 : options.allowDuplicates
          });
        }
        onAdvertisementReceived(event) {
          var _a, _b;
          const deviceId = event.device.id;
          this.deviceMap.set(deviceId, event.device);
          const isNew = !this.discoveredDevices.has(deviceId);
          if (isNew || ((_a = this.requestBleDeviceOptions) === null || _a === void 0 ? void 0 : _a.allowDuplicates)) {
            this.discoveredDevices.set(deviceId, true);
            const device = this.getBleDevice(event.device);
            const result = {
              device,
              localName: device.name,
              rssi: event.rssi,
              txPower: event.txPower,
              manufacturerData: mapToObject(event.manufacturerData),
              serviceData: mapToObject(event.serviceData),
              uuids: (_b = event.uuids) === null || _b === void 0 ? void 0 : _b.map(webUUIDToString)
            };
            this.notifyListeners("onScanResult", result);
          }
        }
        async stopLEScan() {
          var _a;
          if ((_a = this.scan) === null || _a === void 0 ? void 0 : _a.active) {
            this.scan.stop();
          }
          this.scan = null;
        }
        async getDevices(options) {
          const devices = await navigator.bluetooth.getDevices();
          const bleDevices = devices.filter((device) => options.deviceIds.includes(device.id)).map((device) => {
            this.deviceMap.set(device.id, device);
            const bleDevice = this.getBleDevice(device);
            return bleDevice;
          });
          return { devices: bleDevices };
        }
        async getConnectedDevices(_options) {
          const devices = await navigator.bluetooth.getDevices();
          const bleDevices = devices.filter((device) => {
            var _a;
            return (_a = device.gatt) === null || _a === void 0 ? void 0 : _a.connected;
          }).map((device) => {
            this.deviceMap.set(device.id, device);
            const bleDevice = this.getBleDevice(device);
            return bleDevice;
          });
          return { devices: bleDevices };
        }
        async getBondedDevices() {
          return {};
        }
        async connect(options) {
          var _a, _b;
          const device = this.getDeviceFromMap(options.deviceId);
          device.removeEventListener("gattserverdisconnected", this.onDisconnectedCallback);
          device.addEventListener("gattserverdisconnected", this.onDisconnectedCallback);
          const timeoutError = Symbol();
          if (device.gatt === void 0) {
            throw new Error("No gatt server available.");
          }
          try {
            const timeout = (_a = options.timeout) !== null && _a !== void 0 ? _a : this.DEFAULT_CONNECTION_TIMEOUT;
            await runWithTimeout(device.gatt.connect(), timeout, timeoutError);
          } catch (error) {
            await ((_b = device.gatt) === null || _b === void 0 ? void 0 : _b.disconnect());
            if (error === timeoutError) {
              throw new Error("Connection timeout");
            } else {
              throw error;
            }
          }
        }
        onDisconnected(event) {
          const deviceId = event.target.id;
          const key = `disconnected|${deviceId}`;
          this.notifyListeners(key, null);
        }
        async createBond(_options) {
          throw this.unavailable("createBond is not available on web.");
        }
        async isBonded(_options) {
          throw this.unavailable("isBonded is not available on web.");
        }
        async disconnect(options) {
          var _a;
          (_a = this.getDeviceFromMap(options.deviceId).gatt) === null || _a === void 0 ? void 0 : _a.disconnect();
        }
        async getServices(options) {
          var _a, _b;
          const services = (_b = await ((_a = this.getDeviceFromMap(options.deviceId).gatt) === null || _a === void 0 ? void 0 : _a.getPrimaryServices())) !== null && _b !== void 0 ? _b : [];
          const bleServices = [];
          for (const service of services) {
            const characteristics = await service.getCharacteristics();
            const bleCharacteristics = [];
            for (const characteristic of characteristics) {
              bleCharacteristics.push({
                uuid: characteristic.uuid,
                properties: this.getProperties(characteristic),
                descriptors: await this.getDescriptors(characteristic)
              });
            }
            bleServices.push({ uuid: service.uuid, characteristics: bleCharacteristics });
          }
          return { services: bleServices };
        }
        async getDescriptors(characteristic) {
          try {
            const descriptors = await characteristic.getDescriptors();
            return descriptors.map((descriptor) => ({
              uuid: descriptor.uuid
            }));
          } catch (_a) {
            return [];
          }
        }
        getProperties(characteristic) {
          return {
            broadcast: characteristic.properties.broadcast,
            read: characteristic.properties.read,
            writeWithoutResponse: characteristic.properties.writeWithoutResponse,
            write: characteristic.properties.write,
            notify: characteristic.properties.notify,
            indicate: characteristic.properties.indicate,
            authenticatedSignedWrites: characteristic.properties.authenticatedSignedWrites,
            reliableWrite: characteristic.properties.reliableWrite,
            writableAuxiliaries: characteristic.properties.writableAuxiliaries
          };
        }
        async getCharacteristic(options) {
          var _a;
          const service = await ((_a = this.getDeviceFromMap(options.deviceId).gatt) === null || _a === void 0 ? void 0 : _a.getPrimaryService(options === null || options === void 0 ? void 0 : options.service));
          return service === null || service === void 0 ? void 0 : service.getCharacteristic(options === null || options === void 0 ? void 0 : options.characteristic);
        }
        async getDescriptor(options) {
          const characteristic = await this.getCharacteristic(options);
          return characteristic === null || characteristic === void 0 ? void 0 : characteristic.getDescriptor(options === null || options === void 0 ? void 0 : options.descriptor);
        }
        async discoverServices(_options) {
          throw this.unavailable("discoverServices is not available on web.");
        }
        async getMtu(_options) {
          throw this.unavailable("getMtu is not available on web.");
        }
        async requestConnectionPriority(_options) {
          throw this.unavailable("requestConnectionPriority is not available on web.");
        }
        async readRssi(_options) {
          throw this.unavailable("readRssi is not available on web.");
        }
        async read(options) {
          const characteristic = await this.getCharacteristic(options);
          const value = await (characteristic === null || characteristic === void 0 ? void 0 : characteristic.readValue());
          return { value };
        }
        async write(options) {
          const characteristic = await this.getCharacteristic(options);
          let dataView;
          if (typeof options.value === "string") {
            dataView = hexStringToDataView(options.value);
          } else {
            dataView = options.value;
          }
          await (characteristic === null || characteristic === void 0 ? void 0 : characteristic.writeValueWithResponse(dataView));
        }
        async writeWithoutResponse(options) {
          const characteristic = await this.getCharacteristic(options);
          let dataView;
          if (typeof options.value === "string") {
            dataView = hexStringToDataView(options.value);
          } else {
            dataView = options.value;
          }
          await (characteristic === null || characteristic === void 0 ? void 0 : characteristic.writeValueWithoutResponse(dataView));
        }
        async readDescriptor(options) {
          const descriptor = await this.getDescriptor(options);
          const value = await (descriptor === null || descriptor === void 0 ? void 0 : descriptor.readValue());
          return { value };
        }
        async writeDescriptor(options) {
          const descriptor = await this.getDescriptor(options);
          let dataView;
          if (typeof options.value === "string") {
            dataView = hexStringToDataView(options.value);
          } else {
            dataView = options.value;
          }
          await (descriptor === null || descriptor === void 0 ? void 0 : descriptor.writeValue(dataView));
        }
        async startNotifications(options) {
          const characteristic = await this.getCharacteristic(options);
          characteristic === null || characteristic === void 0 ? void 0 : characteristic.removeEventListener("characteristicvaluechanged", this.onCharacteristicValueChangedCallback);
          characteristic === null || characteristic === void 0 ? void 0 : characteristic.addEventListener("characteristicvaluechanged", this.onCharacteristicValueChangedCallback);
          await (characteristic === null || characteristic === void 0 ? void 0 : characteristic.startNotifications());
        }
        onCharacteristicValueChanged(event) {
          var _a, _b;
          const characteristic = event.target;
          const key = `notification|${(_a = characteristic.service) === null || _a === void 0 ? void 0 : _a.device.id}|${(_b = characteristic.service) === null || _b === void 0 ? void 0 : _b.uuid}|${characteristic.uuid}`;
          this.notifyListeners(key, {
            value: characteristic.value
          });
        }
        async stopNotifications(options) {
          const characteristic = await this.getCharacteristic(options);
          await (characteristic === null || characteristic === void 0 ? void 0 : characteristic.stopNotifications());
        }
        getFilters(options) {
          var _a;
          const filters = [];
          for (const service of (_a = options === null || options === void 0 ? void 0 : options.services) !== null && _a !== void 0 ? _a : []) {
            filters.push({
              services: [service],
              name: options === null || options === void 0 ? void 0 : options.name,
              namePrefix: options === null || options === void 0 ? void 0 : options.namePrefix
            });
          }
          if (((options === null || options === void 0 ? void 0 : options.name) || (options === null || options === void 0 ? void 0 : options.namePrefix)) && filters.length === 0) {
            filters.push({
              name: options.name,
              namePrefix: options.namePrefix
            });
          }
          return filters;
        }
        getDeviceFromMap(deviceId) {
          const device = this.deviceMap.get(deviceId);
          if (device === void 0) {
            throw new Error('Device not found. Call "requestDevice", "requestLEScan" or "getDevices" first.');
          }
          return device;
        }
        getBleDevice(device) {
          var _a;
          const bleDevice = {
            deviceId: device.id,
            // use undefined instead of null if name is not available
            name: (_a = device.name) !== null && _a !== void 0 ? _a : void 0
          };
          return bleDevice;
        }
      };
    }
  });

  // src/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    PROTOCOLS: () => PROTOCOLS,
    bluetoothUnavailableReason: () => bluetoothUnavailableReason,
    clearDtcs: () => clearDtcs,
    connectBleNative: () => connectBleNative,
    connectBluetooth: () => connectBluetooth,
    connectSerial: () => connectSerial,
    connectSppNative: () => connectSppNative,
    connectTcpNative: () => connectTcpNative,
    connectWifi: () => connectWifi,
    createDemoElm: () => createDemoElm,
    hasTcpSocket: () => hasTcpSocket,
    hasWebBluetooth: () => hasWebBluetooth,
    initAdapter: () => initAdapter,
    nativeCaps: () => nativeCaps,
    parseWifiTarget: () => parseWifiTarget,
    protocolById: () => protocolById,
    protocolGroups: () => protocolGroups,
    readAllDtcs: () => readAllDtcs,
    readLive: () => readLive,
    serialUnavailableReason: () => serialUnavailableReason,
    traces: () => traces
  });

  // src/kfz/scope.ts
  var GOOD = "#2ee6c7";
  var BAD = "#ff5d6c";
  var MID = "#7eb6ff";
  function clamp(v) {
    return Math.max(0.02, Math.min(0.98, v));
  }
  function line(ys, color, width = 2.4) {
    const x0 = 36;
    const x1 = 688;
    const y0 = 34;
    const y1 = 236;
    let parts = "";
    let pts = [];
    const flush = () => {
      if (pts.length > 1) {
        parts += `<polyline fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(" ")}"/>`;
      }
      pts = [];
    };
    ys.forEach((y, i) => {
      if (y == null || Number.isNaN(y)) {
        flush();
        return;
      }
      const x = x0 + (x1 - x0) * i / (ys.length - 1);
      const yy = y0 + (1 - clamp(y)) * (y1 - y0);
      pts.push(`${x.toFixed(1)},${yy.toFixed(1)}`);
    });
    flush();
    return parts;
  }
  function samples(fn, n = 280) {
    return Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
  }
  function sine(t, cycles, amp, mid) {
    return mid + Math.sin(t * Math.PI * 2 * cycles) * amp;
  }
  function square(t, cycles, lo, hi, duty = 0.5) {
    const p = t * cycles % 1;
    return p < duty ? hi : lo;
  }
  function fixed(kind, good, bad, mid) {
    const lerp = (a, b, x) => a + (b - a) * Math.max(0, Math.min(1, x));
    const ease = (x) => 1 - Math.exp(-Math.max(0, x));
    const toothed = (t, teeth, amp, mid0, gapAt) => {
      const ph = t * teeth, k = Math.floor(ph) % 30;
      if (Math.abs(t - gapAt) < 0.035) return mid0 + (t < gapAt ? 1 : -1) * amp * 1.5 * Math.sin((t - gapAt + 0.035) / 0.07 * Math.PI);
      return mid0 + Math.sin(ph * Math.PI * 2) * amp;
    };
    switch (kind) {
      case "inductive":
        return good((t) => toothed(t, 22, 0.16 + t * 0.2, 0.55, 0.62)) + bad((t) => toothed(t, 22, 0.06, 0.55, 0.62));
      case "sync":
        return mid((t) => (t + 0.02) % 0.5 < 0.12 ? 0.92 : 0.66) + good((t) => Math.abs(t - 0.24) < 0.03 || Math.abs(t - 0.74) < 0.03 ? 0.14 : square(t, 26, 0.14, 0.44, 0.5)) + bad((t) => (t + 0.09) % 0.5 < 0.12 ? 0.92 : 0.66, 1.6);
      case "ramp":
        return good((t) => 0.12 + Math.sin(t * Math.PI) * 0.74) + bad((t) => Math.abs(t - 0.3) < 0.012 || Math.abs(t - 0.62) < 0.01 ? 0.05 : 0.12 + Math.sin(t * Math.PI) * 0.74 - 0.012);
      case "maf":
        return good((t) => t < 0.25 ? 0.2 : t < 0.32 ? lerp(0.2, 0.86, (t - 0.25) / 0.07) : t < 0.36 ? lerp(0.86, 0.74, (t - 0.32) / 0.04) : t < 0.6 ? 0.74 : t < 0.66 ? lerp(0.74, 0.14, (t - 0.6) / 0.06) : t < 0.72 ? lerp(0.14, 0.2, (t - 0.66) / 0.06) : 0.2) + bad((t) => t < 0.25 ? 0.2 : t < 0.6 ? 0.2 + ease((t - 0.25) * 8) * 0.34 : 0.2 + (0.2 + ease(2.8) * 0.34 - 0.2) * Math.exp(-(t - 0.6) * 9));
      case "freq":
        return good((t) => {
          const f = 8 + t * 22;
          return t * f % 1 < 0.5 ? 0.78 : 0.24;
        }) + bad((t) => t < 0.45 ? null : square(t, 12, 0.24, 0.78) - 0.02, 1.8);
      case "map":
        return good((t) => t < 0.15 ? 0.82 : t < 0.2 ? lerp(0.82, 0.3, (t - 0.15) / 0.05) : t < 0.5 ? 0.3 : t < 0.53 ? lerp(0.3, 0.8, (t - 0.5) / 0.03) : t < 0.6 ? lerp(0.8, 0.22, (t - 0.53) / 0.07) : t < 0.7 ? lerp(0.22, 0.3, (t - 0.6) / 0.1) : 0.3) + bad((t) => t < 0.5 ? null : t < 0.62 ? 0.3 + ease((t - 0.5) * 14) * 0.24 : 0.3 + 0.24 * Math.exp(-(t - 0.62) * 8), 2);
      case "rail":
        return good((t) => t < 0.2 ? 0.35 : t < 0.26 ? lerp(0.35, 0.8, (t - 0.2) / 0.06) : t < 0.36 ? 0.8 : t < 0.42 ? lerp(0.8, 0.35, (t - 0.36) / 0.06) : t < 0.6 ? 0.35 : 0.06 + 0.29 * Math.exp(-(t - 0.6) * 3.2)) + bad((t) => t < 0.6 ? null : 0.06 + 0.29 * Math.exp(-(t - 0.6) * 22));
      case "egt":
        return good((t) => 0.18 + Math.pow(t, 1.2) * 0.5) + bad((t) => {
          const b = 0.18 + Math.pow(t, 1.2) * 0.5 - 0.015;
          if (t > 0.8) return 0.96;
          if (Math.abs(t - 0.36) < 6e-3) return b + 0.3;
          if (Math.abs(t - 0.55) < 6e-3) return b - 0.2;
          return t > 0.3 ? b : null;
        });
      case "inj":
        return good((t) => t < 0.3 ? 0.32 : t < 0.52 ? 0.05 : t < 0.535 ? 0.95 : t < 0.56 ? lerp(0.6, 0.36, (t - 0.535) / 0.025) : t < 0.6 ? 0.36 + Math.sin((t - 0.56) / 0.04 * Math.PI) * 0.05 : 0.32) + mid((t) => t < 0.3 ? 0.04 : t < 0.52 ? 0.04 + ease((t - 0.3) * 18) * 0.18 + (t > 0.38 && t < 0.4 ? -0.015 : 0) : t < 0.54 ? lerp(0.22, 0.04, (t - 0.52) / 0.02) : 0.04) + bad((t) => t < 0.51 ? null : t < 0.535 ? 0.5 : t < 0.6 ? 0.33 : null);
      case "gdi":
        return good((t) => t < 0.25 ? 0.05 : t < 0.31 ? lerp(0.05, 0.9, (t - 0.25) / 0.06) : t < 0.34 ? lerp(0.9, 0.42, (t - 0.31) / 0.03) : t < 0.62 ? 0.38 + (t - 0.34) * 60 % 1 * 0.08 : t < 0.64 ? lerp(0.42, 0.05, (t - 0.62) / 0.02) : 0.05) + bad((t) => t < 0.33 ? null : t < 0.36 ? lerp(0.5, 0.05, (t - 0.33) / 0.03) : t < 0.64 ? 0.05 : null);
      case "cr": {
        const pulse = (t, a, w, h) => t < a ? null : t < a + 0.015 ? lerp(0.05, h, (t - a) / 0.015) : t < a + w ? h * 0.55 + (t - a) * 80 % 1 * 0.05 : t < a + w + 0.01 ? lerp(h * 0.55, 0.05, (t - a - w) / 0.01) : null;
        const g = (t) => {
          var _a, _b, _c;
          return (_c = (_b = (_a = pulse(t, 0.12, 0.05, 0.55)) != null ? _a : pulse(t, 0.3, 0.16, 0.9)) != null ? _b : pulse(t, 0.6, 0.05, 0.55)) != null ? _c : 0.05;
        };
        return good(g) + bad((t) => t >= 0.3 && t < 0.48 ? 0.05 : null);
      }
      case "coil":
        return good((t) => t < 0.2 ? 0.06 : t < 0.52 ? lerp(0.06, 0.78, (t - 0.2) / 0.32) : t < 0.66 ? 0.78 : t < 0.67 ? lerp(0.78, 0.06, (t - 0.66) / 0.01) : 0.06) + bad((t) => t < 0.2 ? null : t < 0.34 ? lerp(0.06, 0.78, (t - 0.2) / 0.14) : t < 0.66 ? 0.8 : null);
      case "pwm":
        return good((t) => {
          const p = t * 9 % 1;
          return p < 0.4 ? 0.5 : 0.92;
        }) + mid((t) => {
          const p = t * 9 % 1;
          return p < 0.4 ? 0.12 + p * 0.25 : 0.22 - (p - 0.4) * 0.17;
        }) + bad((t) => t < 0.55 ? null : t * 9 % 1 < 0.4 ? 0.66 : 0.92, 1.8);
      case "pump":
        return good((t) => 0.46 + Math.abs(Math.sin(t * Math.PI * 16)) * 0.22) + bad((t) => {
          const k = Math.floor(t * 16);
          return k % 5 === 2 ? 0.46 + Math.abs(Math.sin(t * Math.PI * 16)) * 0.07 : null;
        });
      case "clamp":
        return good((t) => t < 0.15 ? 0.06 : t < 0.18 ? lerp(0.06, 0.9, (t - 0.15) / 0.03) : t < 0.7 ? 0.42 + 0.48 * Math.exp(-(t - 0.18) * 20) + Math.sin(t * 160) * 0.01 : t < 0.72 ? lerp(0.42, 0.06, (t - 0.7) / 0.02) : 0.06) + bad((t) => t < 0.25 || t > 0.7 ? null : 0.64 + Math.sin(t * 160) * 0.012);
      case "drop":
        return good((t) => t < 0.25 || t > 0.72 ? 0.08 : 0.16) + bad((t) => t < 0.25 || t > 0.72 ? null : 0.62 + Math.sin(t * 90) * 0.02);
      case "crankv": {
        const g = (t) => t < 0.12 ? 0.62 : t < 0.15 ? lerp(0.62, 0.22, (t - 0.12) / 0.03) : t < 0.2 ? lerp(0.22, 0.4, (t - 0.15) / 0.05) : t < 0.66 ? 0.42 + Math.abs(Math.sin((t - 0.2) * Math.PI * 22)) * 0.06 : t < 0.72 ? lerp(0.45, 0.82, (t - 0.66) / 0.06) : 0.8;
        return good(g) + bad((t) => t < 0.15 || t > 0.66 ? null : t < 0.2 ? lerp(0.06, 0.22, (t - 0.15) / 0.05) : 0.22 + Math.abs(Math.sin((t - 0.2) * Math.PI * 22)) * 0.05);
      }
      case "relcomp":
        return good((t) => 0.2 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.6) + bad((t) => Math.floor(t * 4) === 2 && Math.sin(t * Math.PI * 8) > 0 ? 0.2 + Math.sin(t * Math.PI * 8) * 0.25 : null);
      case "exhaust":
        return good((t) => 0.3 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.42) + bad((t) => Math.floor(t * 4) === 2 ? 0.3 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.08 : null);
      case "absind":
        return good((t) => {
          const ph = t * (14 + t * 10);
          return 0.55 + Math.sin(ph * Math.PI * 2) * (0.08 + t * 0.24);
        }) + bad((t) => {
          const ph = t * (14 + t * 10);
          const a = (0.08 + t * 0.24) * 0.95;
          return Math.abs(t - 0.58) < 0.02 ? 0.55 + Math.sin(ph * Math.PI * 2) * a * 0.2 : t > 0.5 && t < 0.66 ? 0.55 + Math.sin(ph * Math.PI * 2) * a : null;
        });
      case "lin":
        return good((t) => {
          if (t < 0.08) return 0.82;
          if (t < 0.2) return 0.14;
          if (t < 0.22) return 0.82;
          if (t < 0.4) return (t - 0.22) * 55 % 2 < 1 ? 0.14 : 0.82;
          const p = t * 37 % 3;
          return p < 1.1 ? 0.14 : 0.82;
        }) + bad((t) => t > 0.6 ? 0.14 : null);
      default:
        return null;
    }
  }
  function traces(kind) {
    const good = (fn) => line(samples(fn, 600), GOOD);
    const bad = (fn, width = 2.2) => line(samples(fn, 600), BAD, width);
    const mid = (fn) => line(samples(fn, 600), MID, 1.8);
    const fx = fixed(kind, good, bad, mid);
    if (fx) return fx;
    switch (kind) {
      case "meter":
        return good((t) => 0.72 - t * 0.22 + (t > 0.46 && t < 0.54 ? -0.34 : 0)) + bad((t) => 0.66 - t * 0.16);
      case "probe":
        return good((t) => 0.55 + Math.sin(t * 18) * 0.22) + bad((t) => t < 0.18 || t > 0.82 ? 0.16 : null);
      case "scale":
        return good((t) => sine(t, 6, 0.32, 0.52)) + bad((t) => {
          const step = Math.floor(t * 18) / 18;
          return sine(step, 6, 0.16, 0.28);
        });
      case "noise":
        return good((t) => square(t, 8, 0.3, 0.76)) + bad((t) => {
          const spike = Math.sin(t * 70) > 0.78 ? 0.2 : Math.sin(t * 36) < -0.88 ? -0.18 : 0;
          return spike === 0 ? null : square(t, 8, 0.3, 0.76) + spike;
        });
      case "clamp":
        return good((t) => 0.42 + (Math.sin(t * Math.PI * 10) > 0 ? 0.26 : 0)) + bad((t) => 0.42 - (Math.sin(t * Math.PI * 10) > 0 ? 0.22 : 0));
      case "drop":
        return good((t) => t > 0.22 && t < 0.74 ? 0.62 : 0.78) + bad((t) => t > 0.28 && t < 0.7 ? 0.22 : 0.74);
      case "inductive":
      case "gap":
      case "absind":
        return good((t) => {
          const grow = kind === "inductive" ? 0.55 + t * 0.85 : 1;
          const gap = Math.abs(t - 0.72) < 0.04;
          const edge = Math.abs(Math.abs(t - 0.72) - 0.055) < 0.018 ? 1.4 : 1;
          return sine(t, 16, (gap ? 0.04 : 0.28) * grow * edge, 0.55);
        }) + bad((t) => {
          const hole = Math.abs(t - 0.38) < 0.035;
          return hole ? 0.42 : sine(t, 16, 0.1, 0.42);
        });
      case "hall":
        return good((t) => square(t, 7, 0.18, 0.82)) + bad((t) => Math.abs(t - 0.48) < 0.07 ? 0.82 : square(t, 7, 0.42, 0.82));
      case "direction":
        return good((t) => {
          const p = t * 8 % 1;
          const w = Math.floor(t * 8) % 2 === 0 ? 0.1 : 0.26;
          return p < w ? 0.8 : 0.22;
        }) + bad((t) => {
          const p = t * 8 % 1;
          return p < 0.16 ? 0.48 : 0.22;
        });
      case "sync":
        return mid((t) => square(t, 5, 0.62, 0.9, 0.16)) + good((t) => square(t, 10, 0.16, 0.46, 0.32)) + bad((t) => t > 0.42 && t < 0.58 ? 0.46 : null);
      case "vvt":
        return mid((t) => square(t, 5, 0.62, 0.9, 0.16)) + good((t) => square(t + 0.04, 10, 0.16, 0.46, 0.32)) + bad((t) => square(t + 0.16, 10, 0.16, 0.46, 0.32));
      case "ramp":
        return good((t) => 0.16 + Math.pow(Math.sin(t * Math.PI), 1.1) * 0.7) + bad((t) => t > 0.34 && t < 0.46 ? 0.28 : t > 0.6 && t < 0.68 ? 0.34 : null);
      case "dual":
        return good((t) => 0.16 + t * 0.7) + mid((t) => 0.86 - t * 0.66) + bad((t) => t > 0.45 ? 0.16 + 0.45 * 0.7 : null);
      case "pedal":
        return good((t) => 0.18 + t * 0.62) + mid((t) => 0.22 + t * 0.3) + bad((t) => t > 0.55 ? 0.22 + 0.55 * 0.3 + (t - 0.55) * 0.9 : null);
      case "maf":
        return good((t) => t < 0.22 ? 0.24 : t < 0.42 ? 0.24 + (t - 0.22) * 3 : t < 0.68 ? 0.84 - (t - 0.42) * 1.5 : 0.28) + bad((t) => t < 0.22 ? 0.24 : t < 0.5 ? 0.24 + (t - 0.22) * 1.1 : 0.55);
      case "freq":
      case "fp":
        return good((t) => square(t, kind === "fp" ? 5 + t * 12 : 14, 0.32, 0.74)) + bad((t) => t < 0.55 ? null : square(t, 4, 0.28, 0.5));
      case "map":
        return good((t) => t < 0.28 ? 0.8 : t < 0.68 ? 0.34 : 0.76) + bad((t) => t < 0.28 ? 0.8 : 0.8 - (t - 0.28) * 0.35);
      case "rail":
        return good((t) => t < 0.58 ? 0.72 : 0.72 - (t - 0.58) * 0.55) + bad((t) => t < 0.42 ? null : 0.7 - (t - 0.42) * 1.35);
      case "lambda":
        return good((t) => square(t, 3.4, 0.22, 0.8, 0.48)) + bad((t) => t < 0.5 ? square(t, 1.4, 0.34, 0.62, 0.7) : 0.78);
      case "wide":
        return mid(() => 0.58) + good((t) => 0.52 + Math.tanh((t - 0.32) * 8) * 0.2 - Math.tanh((t - 0.68) * 10) * 0.26) + bad((t) => t < 0.4 ? null : 0.9);
      case "heater":
        return good((t) => square(t, 14, 0.28, 0.78, Math.max(0.08, 0.78 - t * 0.6))) + bad((t) => t > 0.45 ? 0.78 : null);
      case "knock":
        return good((t) => {
          const burst = (center, amp) => {
            const d = Math.abs(t - center);
            return d < 0.07 ? Math.sin(d * 220) * Math.exp(-d * 26) * amp : 0;
          };
          return 0.5 + burst(0.28, 1.6) + burst(0.68, 1.35);
        }) + bad((t) => {
          const d = Math.abs(t - 0.48);
          return 0.5 + (d < 0.05 ? Math.sin(d * 180) * 0.12 : 0);
        });
      case "ntc":
        return good((t) => 0.84 - Math.pow(t, 0.85) * 0.52) + bad((t) => t < 0.34 ? null : t < 0.36 ? 0.84 - Math.pow(0.34, 0.85) * 0.52 : 0.96) + bad((t) => t < 0.68 ? null : t < 0.7 ? 0.84 - Math.pow(0.68, 0.85) * 0.52 : 0.04);
      case "egt":
        return good((t) => 0.22 + Math.pow(t, 1.15) * 0.5) + bad((t) => {
          const base = (at) => 0.22 + Math.pow(at, 1.15) * 0.5;
          if (Math.abs(t - 0.38) < 0.018) return base(0.38) + 0.26;
          if (Math.abs(t - 0.55) < 0.014) return base(0.55) + 0.22;
          if (t > 0.74) return 0.95;
          return null;
        }) + bad((t) => t > 0.86 ? 0.05 : null);
      case "inj":
        return good((t) => t > 0.3 && t < 0.5 ? 0.1 : t > 0.5 && t < 0.56 ? 0.94 : 0.74) + mid((t) => t > 0.32 && t < 0.5 ? 0.28 + (t - 0.32) * 2.4 : t > 0.5 && t < 0.56 ? 0.55 : 0.18) + bad((t) => t > 0.5 && t < 0.62 ? 0.22 : null);
      case "gdi":
      case "cr":
        return good((t) => {
          const pulses = kind === "cr" ? [0.16, 0.34, 0.54] : [0.32];
          let y = 0.2;
          for (const p of pulses) {
            if (t > p && t < p + 0.05) y = 0.9 - (t - p) / 0.05 * 0.28;
            else if (t >= p + 0.05 && t < p + 0.14) y = 0.48;
          }
          return y;
        }) + bad((t) => {
          const p = kind === "cr" ? 0.34 : 0.32;
          return t > p && t < p + 0.14 ? 0.2 : null;
        });
      case "pwm":
        return good((t) => square(t, 10, 0.22, 0.8, 0.35)) + mid((t) => 0.34 + square(t, 10, 0, 0.2, 0.35)) + bad((t) => t > 0.52 && t < 0.78 ? 0.8 : null);
      case "coil":
        return good((t) => t < 0.18 || t > 0.78 ? 0.2 : t < 0.62 ? 0.2 + (t - 0.18) * 1.2 : t < 0.68 ? 0.92 : 0.2) + bad((t) => t > 0.2 && t < 0.75 ? 0.2 : null);
      case "absact":
        return good((t) => square(t, 9, 0.4, 0.64)) + bad((t) => Math.abs(t - 0.5) < 0.06 ? 0.4 : square(t, 9, 0.52, 0.64));
      case "ak":
        return good((t) => {
          const p = t * 4 % 1;
          if (p < 0.12) return 0.86;
          if (p < 0.42) return square(t * 3, 8, 0.34, 0.56, 0.5);
          return 0.3;
        }) + bad((t) => {
          const n = Math.floor(t * 4);
          if (n !== 2) return null;
          const p = t * 4 % 1;
          return p < 0.42 ? 0.3 : null;
        });
      case "gear":
        return good((t) => square(t, t < 0.5 ? 6 : 11, 0.58, 0.86, 0.4)) + mid((t) => square(t, 8, 0.16, 0.4, 0.4)) + bad((t) => t > 0.6 && t < 0.78 ? 0.58 : null);
      case "pump":
        return good((t) => 0.48 + Math.abs(Math.sin(t * Math.PI * 16)) * 0.22) + bad((t) => t > 0.4 && t < 0.58 ? 0.36 : null);
      case "crankv":
        return good((t) => t > 0.16 && t < 0.72 ? 0.5 : 0.78) + bad((t) => t > 0.2 && t < 0.68 ? 0.18 : 0.72);
      case "relcomp":
        return good((t) => 0.28 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.55) + bad((t) => Math.floor(t * 8) === 3 ? 0.28 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.22 : null);
      case "cyl":
        return good((t) => 0.26 + Math.exp(-Math.pow((t - 0.4) * 8, 2)) * 0.64) + bad((t) => 0.26 + Math.exp(-Math.pow((t - 0.62) * 8, 2)) * 0.28);
      case "exhaust":
        return good((t) => 0.32 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.42) + bad((t) => Math.floor(t * 8) === 5 ? 0.32 : null);
      case "alt":
        return good((t) => 0.62 + Math.abs(Math.sin(t * Math.PI * 18)) * 0.08) + bad((t) => 0.48 + Math.sin(t * 40) * 0.16 - (Math.floor(t * 10) % 4 === 2 ? 0.18 : 0));
      case "can":
        return good((t) => square(t, 16, 0.55, 0.78, 0.4)) + mid((t) => square(t, 16, 0.55, 0.28, 0.4)) + bad((t) => t > 0.62 ? square(t, 16, 0.48, 0.7, 0.4) : null) + bad((t) => t > 0.62 ? square(t, 16, 0.48, 0.34, 0.4) : null, 1.6);
      case "lin":
        return good((t) => t < 0.12 ? 0.18 : square(t, 12, 0.22, 0.8, 0.45)) + bad((t) => t > 0.55 ? 0.18 : null);
      case "sent":
        return good((t) => {
          const p = t * 8 % 1;
          const w = 0.15 + Math.floor(t * 8) % 4 * 0.08;
          return p < w ? 0.78 : 0.24;
        }) + bad((t) => t < 0.55 ? null : t * 8 % 1 < 0.2 ? 0.78 : 0.24);
      case "psi":
        return good((t) => 0.48 + square(t, 18, 0, 0.14, 0.45)) + bad((t) => t > 0.5 ? 0.48 : null);
      case "codes":
      case "summary":
        return good((t) => 0.55 + Math.sin(t * Math.PI * 8) * 0.24) + bad((t) => 0.4 + Math.sin(t * Math.PI * 8 + 0.6) * 0.08);
      default:
        return good((t) => sine(t, 5, 0.28, 0.55)) + bad((t) => t > 0.45 && t < 0.62 ? 0.2 : null);
    }
  }
  var MARK = {
    ntc: `<text x="230" y="58" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u043E\u0431\u0440\u044B\u0432 \u2192 5 \u0412</text><text x="470" y="228" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u0437\u0430\u043C\u044B\u043A\u0430\u043D\u0438\u0435 \u2192 0</text>`,
    egt: `<text x="250" y="58" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u0438\u0433\u043B\u044B, \u043E\u0431\u0440\u044B\u0432</text><text x="560" y="228" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u041A\u0417 \u2192 0</text>`,
    inductive: `<text x="250" y="214" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u043C\u0430\u043B\u0430\u044F \u0430\u043C\u043F\u043B\u0438\u0442\u0443\u0434\u0430, \u043F\u0440\u043E\u0432\u0430\u043B \u0437\u0443\u0431\u0430</text>`,
    hall: `<text x="300" y="120" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u043F\u043E\u043B\u043A\u0430 \u0432\u044B\u0448\u0435 0, \u043F\u0440\u043E\u043F\u0443\u0441\u043A</text>`,
    lambda: `<text x="430" y="70" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u0437\u0430\u043B\u0438\u043F\u043B\u0430 \u0431\u043E\u0433\u0430\u0442\u0430\u044F</text>`,
    rail: `<text x="460" y="200" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u0431\u044B\u0441\u0442\u0440\u044B\u0439 \u0441\u043F\u0430\u0434</text>`,
    drop: `<text x="300" y="190" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u043F\u043B\u043E\u0445\u0430\u044F \u043C\u0430\u0441\u0441\u0430</text>`,
    knock: `<text x="300" y="150" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u0441\u043B\u0430\u0431\u044B\u0439 \u043E\u0442\u043A\u043B\u0438\u043A</text>`,
    crankv: `<text x="300" y="200" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">\u043F\u0440\u043E\u0441\u0430\u0434\u043A\u0430 \u043D\u0438\u0436\u0435 \u043D\u043E\u0440\u043C\u044B</text>`
  };

  // src/obd/protocols.ts
  var PROTOCOLS = [
    {
      id: "auto",
      label: "Automatisch",
      group: "OBD-II gesetzlich",
      detail: "Adapter sucht selbst (ATSP0). Erster Versuch an fast jedem Fahrzeug.",
      kind: "elm",
      elm: "0",
      can: true,
      uds: false
    },
    {
      id: "j1850pwm",
      label: "SAE J1850 PWM",
      group: "OBD-II gesetzlich",
      detail: "41,6 kbit/s Pulsweitenmodulation. Vor allem Ford bis etwa 2008.",
      kind: "elm",
      elm: "1",
      can: false,
      uds: false
    },
    {
      id: "j1850vpw",
      label: "SAE J1850 VPW",
      group: "OBD-II gesetzlich",
      detail: "10,4 kbit/s variable Pulsweite. Vor allem GM.",
      kind: "elm",
      elm: "2",
      can: false,
      uds: false
    },
    {
      id: "iso9141",
      label: "ISO 9141-2",
      group: "OBD-II gesetzlich",
      detail: "K-Leitung, 10,4 kbit/s. Viele asiatische und europ\xE4ische Fahrzeuge bis etwa 2004.",
      kind: "elm",
      elm: "3",
      can: false,
      uds: false
    },
    {
      id: "kwp5",
      label: "ISO 14230-4 KWP2000, 5-Baud-Init",
      group: "OBD-II gesetzlich",
      detail: "Keyword Protocol 2000 mit langsamer Initialisierung. Die Suche kann mehrere Sekunden dauern.",
      kind: "elm",
      elm: "4",
      can: false,
      uds: false
    },
    {
      id: "kwpfast",
      label: "ISO 14230-4 KWP2000, Fast Init",
      group: "OBD-II gesetzlich",
      detail: "Keyword Protocol 2000 mit schneller Initialisierung. Viele EU-Fahrzeuge vor dem CAN-OBD.",
      kind: "elm",
      elm: "5",
      can: false,
      uds: false
    },
    {
      id: "can11_500",
      label: "ISO 15765-4 CAN, 11 bit / 500 kbit/s",
      group: "OBD-II gesetzlich",
      detail: "H\xE4ufigstes OBD-Protokoll seit Modelljahr 2008. Pins 6 und 14.",
      kind: "elm",
      elm: "6",
      can: true,
      uds: false
    },
    {
      id: "can29_500",
      label: "ISO 15765-4 CAN, 29 bit / 500 kbit/s",
      group: "OBD-II gesetzlich",
      detail: "CAN mit erweiterten Kennungen, 500 kbit/s. Unter anderem einige GM-, Honda- und Volvo-Fahrzeuge.",
      kind: "elm",
      elm: "7",
      can: true,
      uds: false
    },
    {
      id: "can11_250",
      label: "ISO 15765-4 CAN, 11 bit / 250 kbit/s",
      group: "OBD-II gesetzlich",
      detail: "CAN 11 bit mit 250 kbit/s.",
      kind: "elm",
      elm: "8",
      can: true,
      uds: false
    },
    {
      id: "can29_250",
      label: "ISO 15765-4 CAN, 29 bit / 250 kbit/s",
      group: "OBD-II gesetzlich",
      detail: "CAN 29 bit mit 250 kbit/s.",
      kind: "elm",
      elm: "9",
      can: true,
      uds: false
    },
    {
      id: "j1939",
      label: "SAE J1939",
      group: "Nutzfahrzeug",
      detail: "Schweres Nutzfahrzeug, Bus, Baumaschine. CAN 29 bit / 250 kbit/s, eigene Suspect-Parameter.",
      kind: "elm",
      elm: "A",
      can: true,
      uds: false
    },
    {
      id: "user1",
      label: "USER1 CAN",
      group: "ELM-Benutzer",
      detail: "Frei einstellbares CAN, Voreinstellung vieler Adapter 11 bit / 125 kbit/s.",
      kind: "elm",
      elm: "B",
      can: true,
      uds: false
    },
    {
      id: "user2",
      label: "USER2 CAN",
      group: "ELM-Benutzer",
      detail: "Zweites frei einstellbares CAN, Voreinstellung oft 11 bit / 50 kbit/s.",
      kind: "elm",
      elm: "C",
      can: true,
      uds: false
    },
    {
      id: "raw11_500",
      label: "ISO 11898 Raw-CAN, 11 bit / 500 kbit/s",
      group: "CAN erweitert (STN)",
      detail: "Roh-CAN ohne OBD-Flusskontrolle. Nur STN/OBDLink, Befehl STP 31. ELM-Klone antworten mit ?.",
      kind: "stn",
      stn: "31",
      can: true,
      uds: false
    },
    {
      id: "raw29_500",
      label: "ISO 11898 Raw-CAN, 29 bit / 500 kbit/s",
      group: "CAN erweitert (STN)",
      detail: "Roh-CAN 29 bit / 500 kbit/s. Nur STN/OBDLink, Befehl STP 32.",
      kind: "stn",
      stn: "32",
      can: true,
      uds: false
    },
    {
      id: "msc11",
      label: "Ford MS-CAN, 11 bit / 125 kbit/s",
      group: "CAN erweitert (STN)",
      detail: "Medium Speed CAN, oft Pins 3 und 11. Nur STN/OBDLink, Befehl STP 51. Kein gesetzliches OBD.",
      kind: "stn",
      stn: "51",
      can: true,
      uds: false
    },
    {
      id: "msc29",
      label: "Ford MS-CAN, 29 bit / 125 kbit/s",
      group: "CAN erweitert (STN)",
      detail: "Medium Speed CAN 29 bit. Nur STN/OBDLink, Befehl STP 52.",
      kind: "stn",
      stn: "52",
      can: true,
      uds: false
    },
    {
      id: "canfd",
      label: "CAN FD, OBD weiter \xFCber ISO 15765-4",
      group: "Moderne Diagnose",
      detail: "Auf CAN-FD-Fahrzeugen l\xE4uft die gesetzliche OBD fast immer noch als klassisches CAN 11 bit / 500. Der Adapter geht auf Protokoll 6. Echtes CAN FD (h\xF6here Datenrate) k\xF6nnen nur neuere STN2120/OBDLink, keine ELM327-Klone.",
      kind: "elm",
      elm: "6",
      can: true,
      uds: false
    },
    {
      id: "obdonuds",
      label: "SAE J1979-2 OBDonUDS",
      group: "Moderne Diagnose",
      detail: "Ab etwa Modelljahr 2020. Physikalisch CAN 11 bit / 500. Fehler \xFCber UDS-Dienst 0x19, nicht nur \xFCber Modus 03.",
      kind: "elm",
      elm: "6",
      can: true,
      uds: true
    },
    {
      id: "wwh",
      label: "ISO 27145 WWH-OBD",
      group: "Moderne Diagnose",
      detail: "World-Wide Harmonized OBD. Dieselben UDS-Dienste wie OBDonUDS, \xFCber CAN.",
      kind: "elm",
      elm: "6",
      can: true,
      uds: true
    },
    {
      id: "doip",
      label: "ISO 13400 DoIP",
      group: "Ethernet und WLAN",
      detail: "Diagnostics over IP, TCP-Port 13400. Neuere Fahrzeuge mit Diagnose-Ethernet. Kein ELM-AT-Befehl, eigener Verbindungsaufbau.",
      kind: "doip",
      can: false,
      uds: true
    },
    {
      id: "kwp1281",
      label: "KWP1281 (\xE4ltere VAG-Steuerger\xE4te)",
      group: "Nicht \xFCber diesen Adapter",
      detail: "Werkstattprotokoll vieler VW/Audi vor KWP2000. Ein ELM327 spricht es nicht. F\xFCr OBD an der genormten Buchse KWP2000 oder CAN w\xE4hlen.",
      kind: "info",
      can: false,
      uds: false
    }
  ];
  function protocolById(id) {
    var _a;
    return (_a = PROTOCOLS.find((p) => p.id === id)) != null ? _a : PROTOCOLS[0];
  }
  function protocolGroups() {
    const out = [];
    for (const p of PROTOCOLS) {
      let g = out.find((x) => x.group === p.group);
      if (!g) {
        g = { group: p.group, items: [] };
        out.push(g);
      }
      g.items.push(p);
    }
    return out;
  }

  // src/obd/dtc.ts
  var LETTERS = ["P", "C", "B", "U"];
  function decodeDtcBytes(hi, lo) {
    var _a, _b, _c, _d;
    const letter = (_a = LETTERS[hi >> 6 & 3]) != null ? _a : "P";
    const d2 = hi >> 4 & 3;
    const hex = "0123456789ABCDEF";
    return letter + String(d2) + ((_b = hex[hi & 15]) != null ? _b : "0") + ((_c = hex[lo >> 4 & 15]) != null ? _c : "0") + ((_d = hex[lo & 15]) != null ? _d : "0");
  }
  function hexOf(code) {
    return parseInt(code.slice(1), 16);
  }
  function inRange(code, from, to) {
    const n = hexOf(code);
    return n >= parseInt(from, 16) && n <= parseInt(to, 16);
  }
  function ch(id, kind, why) {
    return { id, kind, why };
  }
  var wiring = ch(
    "k119",
    "Grundlage",
    "Wenn das Bauteil in Ordnung ist: Leitung, Masse und Steuerger\xE4te-Pin pr\xFCfen, bevor ein Teil getauscht wird."
  );
  var rulesBasic = ch(
    "k1",
    "Grundlage",
    "Zuerst Fehlerspeicher, Freeze Frame und Istwerte. Widerstand nur spannungsfrei messen."
  );
  function cyl(code) {
    const d = code[4];
    if (!d || d < "1" || d > "8") return null;
    return Number(d);
  }
  var RULES = [
    {
      test: (c) => inRange(c, "0100", "0104"),
      title: "Luftmassenmesser, Signal oder Bereich",
      system: "Luftmasse",
      severity: "mittel",
      chapters: [
        ch("k3", "Sensor", "HFM auf Versorgung 12 V, Masse und Frequenz- oder Spannungssignal pr\xFCfen."),
        ch("k12", "Sensor", "Ansauglufttemperatur sitzt oft im gleichen Geh\xE4use und verf\xE4lscht die Luftmasse."),
        ch("k10", "Sensor", "Saugrohrdruck zum Vergleich: passt die Last nicht zur Drehzahl, l\xFCgt einer der beiden."),
        wiring
      ],
      steps: [
        "Freeze Frame: Drehzahl und Last merken.",
        "Stecker auf \xD6lfilm und Falschluft vor dem HFM pr\xFCfen.",
        "Signal im Kapitel Luftmassenmesser mit dem Multimeter oder Oszi vergleichen."
      ]
    },
    {
      test: (c) => inRange(c, "0105", "0109"),
      title: "Saugrohr- oder Ladedrucksensor",
      system: "Ladedruck",
      severity: "mittel",
      chapters: [
        ch("k10", "Sensor", "MAP: 5 V Versorgung, Masse, Signal gegen den tats\xE4chlichen Unter- oder \xDCberdruck."),
        ch("k23", "Aktor", "Druckwandler oder Regelventil, wenn der Ladedruck nicht zum Sollwert passt."),
        ch("k79", "Aktor", "Elektrischer Ladedrucksteller, wenn der Druckgeber selbst in Ordnung ist."),
        wiring
      ],
      steps: [
        "Schlauch zum Sensor auf Riss und falschen Sitz pr\xFCfen.",
        "Z\xFCndung ein, Motor aus: Signal nahe Au\xDFenluftdruck.",
        "Unter Last mit dem Kapitel Saugrohrdruck vergleichen."
      ]
    },
    {
      test: (c) => inRange(c, "0110", "0114"),
      title: "Ansauglufttemperatursensor",
      system: "Ansaugluft",
      severity: "niedrig",
      chapters: [
        ch("k12", "Sensor", "NTC-Widerstand gegen die Temperatur im Kapitel Ansaugluft."),
        ch("k3", "Sensor", "Oft im Luftmassenmesser verbaut. Stecker und Geh\xE4use mitpr\xFCfen."),
        wiring
      ],
      steps: ["Istwert mit einem Thermometer an der Ansaugung vergleichen.", "Stecker ab: Leitung auf Kurzschluss zur Masse oder zu 5 V."]
    },
    {
      test: (c) => inRange(c, "0115", "0119") || c === "P0217" || inRange(c, "0125", "0128"),
      title: (c) => inRange(c, "0125", "0128") ? "K\xFChlmitteltemperatur, kein geschlossener Regelkreis oder Thermostat" : "K\xFChlmitteltemperatursensor",
      system: "K\xFChlmittel",
      severity: "hoch",
      chapters: [
        ch("k4", "Sensor", "NTC-Kennlinie messen. Zu hoher Widerstand wirkt wie ein kalter Motor, zu niedriger wie \xDCberhitzung."),
        ch("k31", "Aktor", "Kennfeldthermostat, wenn der Motor nicht auf Betriebstemperatur kommt."),
        ch("k27", "Aktor", "K\xFChlerl\xFCfter, wenn der Code mit hoher Temperatur oder L\xFCfternachlauf zusammenh\xE4ngt."),
        ch("k35", "Aktor", "Elektrische K\xFChlmittelpumpe, falls verbaut, auf Anlauf und F\xF6rderleistung."),
        wiring
      ],
      steps: [
        "Istwert kalt und warm mit einem Thermometer am Schlauch vergleichen. Abweichung \xFCber etwa 5 \xB0C ist auff\xE4llig.",
        "Sensor abgesteckt: Widerstand nach der NTC-Tabelle in Kapitel 4.",
        "Nicht den Sensor tauschen, wenn das Thermostat den Kreislauf nicht schlie\xDFt."
      ]
    },
    {
      test: (c) => inRange(c, "0120", "0124") || inRange(c, "0220", "0229"),
      title: "Drosselklappe oder Fahrpedal",
      system: "Lastwunsch",
      severity: "hoch",
      chapters: [
        ch("k9", "Sensor", "Drosselklappensteller: beide Potis laufen gegensinnig, Summe grob konstant."),
        ch("k15", "Sensor", "Pedalwertgeber: zwei Spuren, keine Spr\xFCnge beim langsamen Durchtreten."),
        wiring
      ],
      steps: [
        "Grundstellung lernen nur nach der Pr\xFCfung, nicht davor.",
        "Beide Spuren im Oszi oder als Istwert. Ein Sprung ist Kontakt, kein Softwarefehler."
      ]
    },
    {
      test: (c) => inRange(c, "0130", "0167"),
      title: "Lambdasonde, Signal oder Heizung",
      system: "Gemisch und Abgas",
      severity: "mittel",
      chapters: [
        ch("k7", "Sensor", "Sprungsensor schwingt, Breitband h\xE4lt das Regel-mA. Heizungswiderstand nur abgesteckt messen."),
        ch("k3", "Sensor", "Falsche Luftmasse zieht die Sonde in den Anschlag."),
        ch("k8", "Aktor", "Undichte oder h\xE4ngende Einspritzventile vergiften die Regelung."),
        ch("k21", "Aktor", "Kraftstoffdruck zu niedrig oder zu hoch, bevor die Sonde getauscht wird."),
        wiring
      ],
      steps: [
        "Heizkreis und Signal getrennt betrachten. Der Code nennt meist, was von beiden betroffen ist.",
        "Abgasanlage vor der Sonde auf Falschluft (Schellen, Kr\xFCmmer).",
        "Nicht beide Sonden auf Verdacht tauschen."
      ]
    },
    {
      test: (c) => inRange(c, "0170", "0175"),
      title: "Gemischadaption zu mager oder zu fett",
      system: "Gemisch",
      severity: "mittel",
      chapters: [
        ch("k7", "Sensor", "Trim zieht nur, wenn die Lambdaregelung aktiv ist. Sonde und Heizung zuerst im Istwert."),
        ch("k3", "Sensor", "Luftmasse zu hoch oder zu niedrig verschiebt die gesamte Adaption."),
        ch("k21", "Aktor", "Druck und F\xF6rdermenge der Kraftstoffpumpe unter Last."),
        ch("k8", "Aktor", "Injektoren auf Undichtigkeit und Spritzbild, wenn der Druck stimmt."),
        ch("k10", "Sensor", "Falschluft oder falscher Saugrohrdruck bei Systemen ohne HFM."),
        wiring
      ],
      steps: [
        "Kurzzeit- und Langzeitadaption lesen, nicht nur den Code.",
        "Mager: Falschluft, Druck zu niedrig, HFM zu viel Luft. Fett: Druck zu hoch, undichter Injektor, Sensor verdreckt."
      ]
    },
    {
      test: (c) => inRange(c, "0180", "0189"),
      title: "Kraftstofftemperatursensor",
      system: "Kraftstoff",
      severity: "niedrig",
      chapters: [
        ch("k50", "Sensor", "NTC im Vorlauf oder R\xFCcklauf, Kennlinie wie andere Temperatursensoren."),
        ch("k49", "Sensor", "Niederdruck mitpr\xFCfen, der Geber sitzt oft in derselben Leitung."),
        wiring
      ],
      steps: ["Istwert gegen die tats\xE4chliche Kraftstofftemperatur.", "Stecker am Tank auf Korrosion."]
    },
    {
      test: (c) => inRange(c, "0190", "0194"),
      title: "Raildruck, Signal oder Bereich",
      system: "Common Rail",
      severity: "hoch",
      chapters: [
        ch("k14", "Sensor", "Raildrucksensor: 5 V, Masse, Signal. Nie die Hochdruckleitung bei laufendem Motor \xF6ffnen."),
        ch("k26", "Aktor", "Zumesseinheit oder Druckregelventil, wenn der Geber folgt, der Druck aber nicht zum Sollwert."),
        ch("k21", "Aktor", "Vorf\xF6rderdruck muss stehen, sonst regelt der Hochdruck leer."),
        wiring
      ],
      steps: [
        "Soll/Ist-Raildruck im Leerlauf und beim Gassto\xDF vergleichen.",
        "Sensor nur tauschen, wenn die Versorgung stimmt und das Stellglied nicht klemmt."
      ]
    },
    {
      test: (c) => inRange(c, "0200", "0214") || inRange(c, "0261", "0278"),
      title: (c) => {
        const z = cyl(c);
        return z ? `Einspritzventil Zylinder ${z}, elektrisch` : "Einspritzventile, elektrisch";
      },
      system: "Einspritzung",
      severity: "hoch",
      chapters: [
        ch("k8", "Aktor", "Widerstand der Spule und Ansteuerung. Der letzte Ziffer des Codes ist oft die Zylindernummer."),
        ch("k96", "Aktor", "Bei Z\xFCndaussetzern die Kerze des gleichen Zylinders nicht vergessen."),
        wiring
      ],
      steps: [
        "Widerstand gegen die anderen Zylinder vergleichen, nicht gegen einen Katalogwert allein.",
        "Leitung vom Steuerger\xE4t bis zum Stecker durchklingeln, Kapitel Leitungspr\xFCfung."
      ]
    },
    {
      test: (c) => inRange(c, "0230", "0233"),
      title: "Kraftstoffpumpe, Ansteuerung",
      system: "Kraftstoff",
      severity: "hoch",
      chapters: [
        ch("k21", "Aktor", "Pumpe, Relais und Vorf\xF6rderdruck. Stromaufnahme unter Last."),
        ch("k49", "Sensor", "Niederdrucksensor, falls der Druck elektrisch gemeldet wird."),
        ch("k109", "Netz", "Relais und Sicherung der Pumpe vor dem Tausch der Pumpe."),
        wiring
      ],
      steps: ["H\xF6rt die Pumpe beim Einschalten der Z\xFCndung kurz an?", "Druck im Kapitel Kraftstoffpumpe, nicht nur die Spannung am Stecker."]
    },
    {
      test: (c) => inRange(c, "0234", "0250") || c === "P0299",
      title: "Ladedruck zu hoch oder zu niedrig",
      system: "Aufladung",
      severity: "hoch",
      chapters: [
        ch("k23", "Aktor", "Druckwandler, Unterdruckdosen und Schl\xE4uche."),
        ch("k79", "Aktor", "Elektrischer Steller an VTG oder Wastegate: Grundstellung und Verfahrweg."),
        ch("k10", "Sensor", "Ladedruckgeber muss den gleichen Trend zeigen wie der Sollwert."),
        wiring
      ],
      steps: [
        "Schl\xE4uche und Schellen vor dem Steller. Ein gerissener Unterdruckschlauch ist h\xE4ufiger als ein defektes Steuerger\xE4t.",
        "Steller von Hand oder mit dem Stellgliedtest bewegen."
      ]
    },
    {
      test: (c) => inRange(c, "0300", "0308") || inRange(c, "0313", "0316"),
      title: (c) => {
        const z = cyl(c);
        return z ? `Z\xFCndaussetzer Zylinder ${z}` : "Z\xFCndaussetzer, mehrere Zylinder";
      },
      system: "Verbrennung",
      severity: "hoch",
      chapters: [
        ch("k19", "Aktor", "Z\xFCndspule des genannten Zylinders. Mit einem anderen Zylinder tauschen und sehen, ob der Code mitwandert."),
        ch("k96", "Aktor", "Z\xFCndkerze und Kerzenstecker, Widerstand des Entst\xF6rglieds."),
        ch("k8", "Aktor", "Injektor des gleichen Zylinders, wenn die Z\xFCndung in Ordnung ist."),
        ch("k5", "Sensor", "Kurbelwellensensor bei Aussetzern auf allen Zylindern oder bei Absterben."),
        ch("k11", "Sensor", "Klopfsensor nur mitpr\xFCfen, wenn die Klopfregelung gleichzeitig abschaltet."),
        wiring
      ],
      steps: [
        "Ein Zylinder: Spule und Kerze untereinander tauschen. Wandert der Code, ist das Teil gefunden.",
        "Alle Zylinder: Kraftstoffdruck, Luftmasse, Steuerzeiten, nicht acht Spulen auf Verdacht."
      ]
    },
    {
      test: (c) => inRange(c, "0324", "0334"),
      title: "Klopfsensor",
      system: "Klopfregelung",
      severity: "mittel",
      chapters: [
        ch("k11", "Sensor", "Piezo, Anzugsmoment und geschirmte Leitung. Kein Ohmmeter als einzige Pr\xFCfung."),
        ch("k19", "Aktor", "Falsche Z\xFCndung oder schlechter Kraftstoff erzeugt echtes Klopfen, nicht nur einen defekten Sensor."),
        wiring
      ],
      steps: ["Anzugsmoment und Anlagefl\xE4che. Ein loser Sensor ist ein h\xE4ufiger Code.", "Leitung nicht anstechen, die Schirmung ist das Signal."]
    },
    {
      test: (c) => inRange(c, "0320", "0323") || inRange(c, "0335", "0339"),
      title: "Kurbelwellensensor oder Drehzahlsignal",
      system: "Drehzahl",
      severity: "hoch",
      chapters: [
        ch("k5", "Sensor", "Induktiv: Widerstand und Wechselspannung beim Drehen. Hall: Versorgung und Rechteck, kein Ohmmeter am Hallgeber."),
        ch("k6", "Sensor", "Nockenwelle mitlesen. Ohne Bezugsmarke startet der Motor nicht sauber."),
        wiring
      ],
      steps: ["Luftspalt und Metallsp\xE4ne am Geberrad.", "Signal beim Anlassen im Oszi, nicht nur im Fehlerspeicher."]
    },
    {
      test: (c) => inRange(c, "0340", "0349") || inRange(c, "0010", "0025"),
      title: (c) => inRange(c, "0010", "0025") ? "Nockenwellenverstellung, Ansteuerung oder Lage" : "Nockenwellensensor",
      system: "Steuerzeiten",
      severity: "hoch",
      chapters: [
        ch("k6", "Sensor", "Nockenwellensensor: Hall-Signal gegen die Kurbelwelle phasenrichtig."),
        ch("k24", "Aktor", "Magnetventil der Nockenwellenverstellung, \xD6lversorgung und Sieb."),
        wiring
      ],
      steps: [
        "\xD6lstand und \xD6ldruck. Die Verstellung h\xE4ngt am \xD6l, nicht nur am Magnetventil.",
        "Sensor und Ventil nicht gemeinsam tauschen."
      ]
    },
    {
      test: (c) => inRange(c, "0350", "0362"),
      title: (c) => {
        const z = cyl(c);
        return z ? `Z\xFCndspule Zylinder ${z}` : "Z\xFCndspule oder Z\xFCndendstufe";
      },
      system: "Z\xFCndung",
      severity: "hoch",
      chapters: [
        ch("k19", "Aktor", "Prim\xE4rkreis und Ansteuerung der genannten Spule."),
        ch("k96", "Aktor", "Kerze und Kabel, bevor die Spule verurteilt wird."),
        wiring
      ],
      steps: ["Spule mit einem anderen Zylinder tauschen.", "Versorgung 12 V und Masse am Stecker bei eingeschalteter Z\xFCndung."]
    },
    {
      test: (c) => inRange(c, "0380", "0384"),
      title: "Gl\xFChkerze oder Gl\xFChzeitsteuerger\xE4t",
      system: "Diesel-Kaltstart",
      severity: "mittel",
      chapters: [
        ch("k20", "Aktor", "Einzelne Kerze gegen die anderen messen. Das Steuerger\xE4t schaltet den Strom."),
        wiring
      ],
      steps: ["Stromaufnahme aller Kerzen vergleichen.", "Eine abweichende Kerze ist meist die Ursache, nicht das ganze Steuerger\xE4t."]
    },
    {
      test: (c) => inRange(c, "0400", "0409"),
      title: "Abgasr\xFCckf\xFChrung",
      system: "AGR",
      severity: "mittel",
      chapters: [
        ch("k22", "Aktor", "Ventil auf Verkokung und Stellweg. Elektrisch: Widerstand und Ansteuerung."),
        ch("k10", "Sensor", "Der Saugrohrdruck zeigt, ob das Ventil wirklich \xF6ffnet."),
        wiring
      ],
      steps: ["Ventil ausbauen und mechanisch pr\xFCfen, nicht nur den Stellgliedtest.", "Leitungen zum Unterdrucksteller, falls pneumatisch."]
    },
    {
      test: (c) => inRange(c, "0420", "0430"),
      title: "Katalysator, Wirkung zu gering",
      system: "Abgasnachbehandlung",
      severity: "mittel",
      chapters: [
        ch("k7", "Sensor", "Beide Lambdasonden vergleichen. Eine tr\xE4ge Sonde hinter dem Kat sieht aus wie ein schwacher Kat."),
        ch("k16", "Sensor", "Abgastemperatur, wenn der Kat nicht auf Temperatur kommt."),
        rulesBasic
      ],
      steps: [
        "Sonden tauschen nur als Probe untereinander, nicht den Kat zuerst.",
        "Aussetzer und zu fettes Gemisch zerst\xF6ren den Kat. Die Ursache davor suchen."
      ]
    },
    {
      test: (c) => inRange(c, "0440", "0459"),
      title: "Tankentl\xFCftung oder Tankleck",
      system: "EVAP",
      severity: "niedrig",
      chapters: [
        ch("k25", "Aktor", "Tankentl\xFCftungsventil: es muss stromlos schlie\xDFen und darf im Leerlauf nicht zischen."),
        ch("k77", "Sensor", "Tankdrucksensor f\xFCr die Leckdiagnose."),
        ch("k99", "Aktor", "Leckdiagnosepumpe, falls der Code eine Dichtheitspr\xFCfung nennt."),
        ch("k51", "Sensor", "Tankdeckel und Entl\xFCftung mitpr\xFCfen, der Geber sitzt im gleichen System."),
        wiring
      ],
      steps: ["Tankdeckel richtig zu und die Dichtung ganz. Das ist die h\xE4ufigste Ursache.", "Schl\xE4uche am Aktivkohlebeh\xE4lter auf Br\xFCche."]
    },
    {
      test: (c) => inRange(c, "0460", "0463"),
      title: "Kraftstoffstandgeber",
      system: "Tank",
      severity: "niedrig",
      chapters: [
        ch("k51", "Sensor", "Hebelgeber, Widerstand \xFCber den Weg. H\xE4ufig ein ausgeleiertes Potentiometer."),
        wiring
      ],
      steps: ["Anzeige gegen den tats\xE4chlichen Inhalt.", "Schwimmer mechanisch frei."]
    },
    {
      test: (c) => inRange(c, "0470", "0479") || inRange(c, "2452", "2463") || inRange(c, "2002", "2003"),
      title: "Partikelfilter oder Abgasdruck",
      system: "Diesel-Abgas",
      severity: "hoch",
      chapters: [
        ch("k17", "Sensor", "Differenzdruck \xFCber den Filter. Schl\xE4uche nicht vertauscht und nicht mit Kondensat voll."),
        ch("k54", "Sensor", "Abgasgegendruck vor dem Filter."),
        ch("k53", "Sensor", "Partikelsensor hinter dem Filter, wenn der Code den Ru\xDFsensor nennt."),
        ch("k52", "Sensor", "NOx-Sensor, wenn die Regeneration oder SCR mit im Speicher steht."),
        ch("k36", "Aktor", "AdBlue-Dosierventil nur bei SCR-Codes, nicht bei jedem DPF-Eintrag."),
        wiring
      ],
      steps: ["Druckschl\xE4uche abziehen und frei blasen, bevor der Sensor neu ist.", "Beladung und letzte Regeneration im Steuerger\xE4t lesen."]
    },
    {
      test: (c) => inRange(c, "0480", "0495"),
      title: "K\xFChlerl\xFCfter",
      system: "K\xFChlung",
      severity: "hoch",
      chapters: [
        ch("k27", "Aktor", "L\xFCfterstufe, Vorwiderstand oder Ansteuermodul, Stromaufnahme."),
        ch("k4", "Sensor", "Ein falscher K\xFChlmittelgeber schaltet den L\xFCfter zur falschen Zeit."),
        ch("k109", "Netz", "Sicherung und Relais der L\xFCfterstufe."),
        wiring
      ],
      steps: ["L\xE4uft der L\xFCfter im Stellgliedtest?", "Vorwiderstand auf Brandspuren."]
    },
    {
      test: (c) => inRange(c, "0500", "0503"),
      title: "Geschwindigkeitssignal",
      system: "Fahrgeschwindigkeit",
      severity: "mittel",
      chapters: [
        ch("k55", "Sensor", "Getriebe- oder Abtriebsdrehzahl."),
        ch("k13", "Sensor", "Raddrehzahl, wenn die Geschwindigkeit aus dem ABS kommt."),
        ch("k104", "Netz", "Das Signal h\xE4ngt oft am CAN, nicht an einer einzelnen Leitung."),
        wiring
      ],
      steps: ["Welche R\xE4der melden Drehzahl, welches steht auf null.", "Stecker am Getriebe auf \xD6l."]
    },
    {
      test: (c) => inRange(c, "0505", "0507"),
      title: "Leerlaufdrehzahl",
      system: "Leerlauf",
      severity: "mittel",
      chapters: [
        ch("k32", "Aktor", "Leerlaufsteller an \xE4lteren Drosselklappen."),
        ch("k9", "Sensor", "Elektronische Drosselklappe: Grundstellung und Verschmutzung."),
        ch("k22", "Aktor", "AGR, die im Leerlauf nicht schlie\xDFt, zieht die Drehzahl."),
        wiring
      ],
      steps: ["Falschluft am Ansaugtrakt mit Bremsenreiniger nur vorsichtig und nie an hei\xDFen Teilen.", "Drosselklappe auf Kohle, nicht sofort das Steuerger\xE4t."]
    },
    {
      test: (c) => inRange(c, "0520", "0524"),
      title: "\xD6ldruck",
      system: "Schmierung",
      severity: "hoch",
      chapters: [
        ch("k18", "Sensor", "Schalter oder Drucksensor. Ein echter Druckmangel zerst\xF6rt den Motor, den Geber nicht blind glauben."),
        ch("k80", "Aktor", "Regelventil der \xD6lpumpe, wenn der Druck elektrisch geregelt wird."),
        wiring
      ],
      steps: ["Mechanischen Druckmesser parallel setzen, bevor der Motor weiterl\xE4uft.", "\xD6lstand und das richtige \xD6l."]
    },
    {
      test: (c) => inRange(c, "0530", "0534"),
      title: "K\xE4ltemitteldruck",
      system: "Klimaanlage",
      severity: "niedrig",
      chapters: [
        ch("k58", "Sensor", "Drucksensor an der Klimaleitung, 5 V und Signal."),
        ch("k34", "Aktor", "Magnetkupplung oder Regelventil nur, wenn der Druck real au\xDFerhalb des Fensters liegt."),
        wiring
      ],
      steps: ["Anlage gef\xFCllt? Ein leerer Kreislauf \xF6ffnet die Kupplung nicht.", "Nicht an HV-Klimakompressoren ohne Qualifikation arbeiten."]
    },
    {
      test: (c) => inRange(c, "0560", "0563") || inRange(c, "0620", "0623"),
      title: "Bordnetzspannung oder Generator",
      system: "12 V",
      severity: "hoch",
      chapters: [
        ch("k102", "Sensor", "Starterbatterie: Ruhespannung, Innenwiderstand, Masseband."),
        ch("k29", "Aktor", "Generator und Regler, Ladekontrolle, B+ und die kleine Erregerleitung."),
        ch("k45", "Sensor", "Intelligenter Batteriesensor auf dem Pol, oft die Quelle von Spannungs-Codes."),
        ch("k103", "Netz", "Ruhestrom, wenn die Spannung \xFCber Nacht f\xE4llt."),
        wiring
      ],
      steps: [
        "Spannung Motor aus und bei laufendem Motor. Unter etwa 13,5 V bei Drehzahl l\xE4dt der Generator nicht ausreichend.",
        "Masseb\xE4nder an Karosserie und Motor blank und fest."
      ]
    },
    {
      test: (c) => c === "P0571" || inRange(c, "0571", "0573"),
      title: "Bremspedalschalter",
      system: "Bremse",
      severity: "mittel",
      chapters: [
        ch("k63", "Sensor", "Zwei Kreise: Bremslicht und das Signal ans Motorsteuerger\xE4t. Sie d\xFCrfen nicht widersprechen."),
        wiring
      ],
      steps: ["Pedalspiel und die Einstellung des Schalters.", "Bremslicht leuchtet, das Steuerger\xE4t sieht das Pedal aber nicht: zwei verschiedene Kontakte."]
    },
    {
      test: (c) => inRange(c, "0600", "0614"),
      title: "Steuerger\xE4t, interner oder Kommunikationsfehler",
      system: "Steuerger\xE4t",
      severity: "hoch",
      chapters: [
        ch("k119", "Grundlage", "Versorgung, Masse und CAN am Steuerger\xE4t, bevor es getauscht wird."),
        ch("k104", "Netz", "Ein interner Code entsteht oft durch Spannungseinbr\xFCche auf dem Bus."),
        ch("k102", "Netz", "Batteriespannung w\xE4hrend des Startens."),
        rulesBasic
      ],
      steps: ["Spannungseinbruch beim Start messen.", "Steuerger\xE4t nicht tauschen, solange Versorgung und Masse nicht belegt sind."]
    },
    {
      test: (c) => inRange(c, "0630", "0638"),
      title: "Wegfahrsperre oder VIN",
      system: "Diebstahlschutz",
      severity: "hoch",
      chapters: [
        ch("k112", "Netz", "Schl\xFCssel, Transponder und Steuerger\xE4t m\xFCssen zusammenpassen."),
        wiring
      ],
      steps: ["Zweiten Schl\xFCssel versuchen.", "Nach einem Steuerger\xE4tetausch ist das ein Anpassungsproblem, kein Sensordefekt."]
    },
    {
      test: (c) => inRange(c, "0700", "0799") || c === "P0218",
      title: (c) => inRange(c, "0710", "0714") || c === "P0218" ? "Getriebe\xF6ltemperatur" : "Automatikgetriebe",
      system: "Getriebe",
      severity: "hoch",
      chapters: [
        ch("k81", "Aktor", "Magnetventile im Schaltschieber, Widerstand und \xD6lqualit\xE4t."),
        ch("k56", "Sensor", "Getriebe\xF6ltemperatur. Zu hei\xDF: K\xFChler und Stand, nicht zuerst das Ventil."),
        ch("k55", "Sensor", "Drehzahlf\xFChler Eingang und Ausgang. Ohne sie schaltet das Getriebe in den Notlauf."),
        wiring
      ],
      steps: ["\xD6lstand und der richtige Stand bei der vorgeschriebenen Temperatur.", "Metallsp\xE4ne in der \xD6lwanne bedeuten Mechanik, nicht nur ein Ventil."]
    },
    {
      test: (c) => inRange(c, "0A00", "0CFF"),
      title: "Hybrid- oder Hochvoltbatterie",
      system: "Hochvolt",
      severity: "hoch",
      chapters: [
        ch("k38", "Netz", "HV-Batterie, Sch\xFCtze und Vorladung. Nicht \xF6ffnen ohne Qualifikation."),
        ch("k37", "Grundlage", "Freischalten und Spannungsfreiheit nach DGUV, bevor irgendetwas gemessen wird."),
        ch("k40", "Sensor", "HV-Interlock, wenn der Code eine ge\xF6ffnete Service-Trennstelle nennt."),
        ch("k41", "Aktor", "DC/DC-Wandler, wenn gleichzeitig das 12-V-Netz schwach ist.")
      ],
      steps: [
        "Keine Orangenen Leitungen \xF6ffnen und keinen Isolationswiderstand ohne die Qualifikation nach DGUV Information 209-093 messen.",
        "12-V-Batterie trotzdem pr\xFCfen. Viele HV-Codes starten mit einem schwachen Bordnetz."
      ],
      summary: "Hochvolt. Nur zur Einordnung. Messen an der HV-Anlage nur mit Qualifikation."
    },
    {
      test: (c) => c.startsWith("P0") && inRange(c, "0D00", "0FFF"),
      title: "Elektrische Maschine oder Hybridantrieb",
      system: "E-Antrieb",
      severity: "hoch",
      chapters: [
        ch("k39", "Aktor", "E-Maschine und Resolver. Resolver nicht mit einem Ohmmeter am Hall-Prinzip verwechseln."),
        ch("k37", "Grundlage", "HV-Sicherheit vor jeder Messung."),
        ch("k114", "Netz", "Bei 48-V-Mildhybrid den Riemen-Starter-Generator getrennt betrachten."),
        wiring
      ],
      steps: ["Fehlerumgebung: tritt er beim elektrischen Fahren oder nur beim Start auf?", "Keine HV-Stecker ziehen, solange die Sch\xFCtze nicht offen und die Spannungsfreiheit nicht festgestellt ist."]
    }
  ];
  var BODY_RULES = [
    {
      test: (c) => c.startsWith("C") && inRange(c, "0030", "005F"),
      title: (c) => `Raddrehzahlsensor ${c}`,
      system: "ABS",
      severity: "hoch",
      chapters: [
        ch("k13", "Sensor", "Luftspalt, Tonrad und das Signal beim Drehen des Rades von Hand."),
        ch("k104", "Netz", "Das ABS gibt die Drehzahl oft per CAN an andere Steuerger\xE4te."),
        wiring
      ],
      steps: ["Welches Rad der Code meint, im Kapitel oder im Schaltplan nachschlagen. Die Nummer ist herstellerabh\xE4ngig.", "Sensor und Leitung am Radlauf, Scheuerstellen."]
    },
    {
      test: (c) => c.startsWith("C"),
      title: "Fahrwerk, ABS oder ESP",
      system: "Fahrdynamik",
      severity: "hoch",
      chapters: [
        ch("k13", "Sensor", "Raddrehzahlen vergleichen. Ein Ausrei\xDFer reicht f\xFCr ESP-Notlauf."),
        ch("k64", "Sensor", "Drehrate und Querbeschleunigung, Einbaulage und Kalibrierung."),
        ch("k44", "Sensor", "Lenkwinkel, Geradeauslauf kalibrieren erst nach der Pr\xFCfung der Raddrehzahlen."),
        ch("k67", "Sensor", "Bremsdruck, wenn der Code die Hydraulikeinheit nennt."),
        ch("k101", "Aktor", "Elektromechanischer Bremskraftverst\xE4rker nur bei den zugeh\xF6rigen Codes."),
        wiring
      ],
      steps: ["Alle vier Raddrehzahlen im Stand und beim langsamen Rollen.", "Nicht die Hydraulikeinheit tauschen, solange ein Radsensor l\xFCgt."]
    },
    {
      test: (c) => c.startsWith("B") && (inRange(c, "0001", "00FF") || inRange(c, "1000", "14FF")),
      title: "R\xFCckhaltesystem",
      system: "Airbag",
      severity: "hoch",
      chapters: [
        ch("k100", "Aktor", "Z\xFCndkreis, Widerstand der Z\xFCndpille nur mit dem vorgeschriebenen Verfahren. Kein normales Ohmmeter an die Z\xFCndpille."),
        ch("k69", "Sensor", "Gurtschloss und Sitzbelegung, oft der Grund f\xFCr eine Lampe ohne Unfall."),
        ch("k70", "Sensor", "Satellitensensor, Stecker unter dem Sitz oder im Schweller."),
        wiring
      ],
      steps: [
        "Batterie abklemmen und die Wartezeit des Herstellers einhalten, bevor ein Stecker im Z\xFCndkreis gezogen wird.",
        "Widerstandsmessung an der Z\xFCndpille kann den Airbag z\xFCnden. Kapitel Airbag-Z\xFCndkreis lesen, bevor gemessen wird."
      ]
    },
    {
      test: (c) => c.startsWith("B"),
      title: "Karosserieelektrik",
      system: "Komfort",
      severity: "niedrig",
      chapters: [
        ch("k109", "Netz", "Sicherung und Relais des genannten Verbrauchers."),
        ch("k119", "Grundlage", "Leitung und Massepunkt. Karosserie-Codes sind oft \xDCbergangswiderst\xE4nde."),
        ch("k105", "Netz", "Viele Komfortger\xE4te h\xE4ngen am LIN, nicht am CAN."),
        ch("k82", "Aktor", "Wischer, Fenster, Schloss und Gebl\xE4se stehen in den Aktuator-Kapiteln, wenn der Code einen davon nennt.")
      ],
      steps: ["Den exakten Herstellercode im Schaltplan nachschlagen. B-Codes sind selten genormt.", "Sicherung und Stecker vor dem Stellmotor."]
    },
    {
      test: (c) => c.startsWith("U"),
      title: (c) => c === "U0100" ? "Keine Verbindung zum Motorsteuerger\xE4t" : "Kommunikation im Bordnetz",
      system: "Datenbus",
      severity: "hoch",
      chapters: [
        ch("k104", "Netz", "CAN: beide Leitungen etwa 60 \u03A9 zwischen CAN-High und CAN-Low, Z\xFCndung aus, Adapter ab."),
        ch("k105", "Netz", "LIN, wenn das fehlende Ger\xE4t ein Komfortteil ist (Gebl\xE4se, Tankgeber, Generator an manchen Autos)."),
        ch("k106", "Netz", "FlexRay nur bei den Fahrwerken und einigen BMW/Mercedes-Steuerger\xE4ten, die es wirklich nutzen."),
        ch("k108", "Grundlage", "OBD-Buchse selbst: Pin 6 und 14, Pin 16 Spannung, Pin 4 und 5 Masse."),
        ch("k119", "Grundlage", "Ein stiller Teilnehmer: Versorgung des Steuerger\xE4ts, nicht sofort den Bus verd\xE4chtigen."),
        wiring
      ],
      steps: [
        "Z\xFCndung ein: etwa 2,5 V auf beiden CAN-Leitungen gegen Masse. Eine Leitung auf 0 V oder auf Batterieplus ist ein Kurzschluss.",
        "Fehlt nur ein Steuerger\xE4t, dessen Sicherung und Stecker pr\xFCfen. Fehlen viele, den Bus und die Abschlusswiderst\xE4nde."
      ]
    }
  ];
  var KNOWN_CHAPTERS = new Set(
    Array.from({ length: 120 }, (_, i) => "k" + String(i + 1))
  );

  // src/obd/elm.ts
  function stripEcho(command, raw2) {
    const lines = raw2.split(/\r|\n/).map((s) => s.trim()).filter(Boolean);
    const cmd = command.replace(/\s/g, "").toUpperCase();
    if (lines[0] && lines[0].replace(/\s/g, "").toUpperCase() === cmd) lines.shift();
    return lines.join("\n");
  }
  function hexBytes(line2) {
    const parts = line2.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return [];
    if (!parts.every((p) => /^[0-9A-Fa-f]{1,2}$/.test(p))) return [];
    return parts.map((p) => parseInt(p, 16));
  }
  function payloadAfter(raw2, service) {
    const bytes = [];
    for (const line2 of raw2.split(/\r|\n/)) {
      const nums = hexBytes(line2);
      if (!nums.length) continue;
      if (nums[0] === service) bytes.push(...nums.slice(1));
      else if (bytes.length) bytes.push(...nums);
    }
    return bytes;
  }
  function dtcsFromPayload(bytes, canCountByte) {
    var _a, _b, _c;
    if (!bytes.length) return [];
    let data = bytes;
    if (canCountByte) {
      const count = (_a = bytes[0]) != null ? _a : 0;
      if (count === 0) return [];
      if (count <= 16 && bytes.length >= 1 + count * 2) data = bytes.slice(1, 1 + count * 2);
    }
    const out = [];
    for (let i = 0; i + 1 < data.length; i += 2) {
      const hi = (_b = data[i]) != null ? _b : 0;
      const lo = (_c = data[i + 1]) != null ? _c : 0;
      if (hi === 0 && lo === 0) continue;
      const code = decodeDtcBytes(hi, lo);
      if (!out.includes(code)) out.push(code);
    }
    return out;
  }
  function parseDtcResponse(raw2, service, can) {
    var _a;
    if (/NO DATA|UNABLE|ERROR/i.test(raw2) && !hexBytes((_a = raw2.split(/\n/)[0]) != null ? _a : "")) {
      if (!/[0-9A-F]{2}/i.test(raw2)) return [];
    }
    return dtcsFromPayload(payloadAfter(raw2, service), can);
  }
  function parseUdsDtcs(raw2) {
    var _a, _b, _c;
    const bytes = payloadAfter(raw2, 89);
    if (bytes.length < 3) return [];
    const records = bytes.slice(2);
    const out = [];
    for (let i = 0; i + 3 < records.length; i += 4) {
      const a = (_a = records[i]) != null ? _a : 0;
      const b = (_b = records[i + 1]) != null ? _b : 0;
      const c = (_c = records[i + 2]) != null ? _c : 0;
      if (a === 0 && b === 0 && c === 0) continue;
      const code = decodeDtcBytes(a, b);
      if (!out.includes(code)) out.push(code);
    }
    return out;
  }
  function isCanProtocolName(name) {
    return /can|15765|j1939|11898/i.test(name);
  }
  async function initAdapter(io, protocol) {
    if (protocol.kind === "info") {
      throw new Error(protocol.detail);
    }
    if (protocol.kind === "doip") {
      throw new Error("DOIP");
    }
    await io.send("ATZ", 5e3);
    await io.send("ATE0");
    await io.send("ATL0");
    await io.send("ATS0");
    await io.send("ATH0");
    await io.send("ATCAF1");
    await io.send("ATAT1");
    await io.send("ATST96");
    if (protocol.kind === "stn" && protocol.stn) {
      const answer = await io.send("STP " + protocol.stn);
      if (answer.trim() === "?" || /^\?/.test(answer.trim())) {
        throw new Error(
          protocol.label + " wird von diesem Adapter nicht unterst\xFCtzt. Daf\xFCr braucht es einen STN- oder OBDLink-Chip, keinen ELM327-Klon."
        );
      }
    } else if (protocol.elm) {
      await io.send("ATSP" + protocol.elm);
    }
    const probe = await io.send("0100", 8e3);
    const name = (await io.send("ATDP")).replace(/\s+/g, " ").trim();
    const number = (await io.send("ATDPN")).trim();
    let warning = "";
    if (/UNABLE TO CONNECT|NO DATA|ERROR|BUS INIT/i.test(probe)) {
      warning = "Steuerger\xE4t antwortet nicht auf 0100. Z\xFCndung ein, Adapter fest in der Buchse, Protokoll pr\xFCfen.";
    }
    const can = protocol.can || isCanProtocolName(name) || /[6-9A]$/i.test(number.replace(/^A/, ""));
    return { name: name || protocol.label, number, can, probe, warning };
  }
  async function readAllDtcs(io, can, alsoUds) {
    const stored = parseDtcResponse(await io.send("03", 8e3), 67, can);
    const pending = parseDtcResponse(await io.send("07", 8e3), 71, can);
    const permanent = parseDtcResponse(await io.send("0A", 8e3), 74, can);
    let uds = [];
    if (alsoUds || stored.length + pending.length + permanent.length === 0) {
      try {
        await io.send("ATSH7E0");
        const raw2 = await io.send("190209", 8e3);
        if (!/NO DATA|UNABLE|\?/i.test(raw2) || /59/.test(raw2)) uds = parseUdsDtcs(raw2);
      } catch {
        uds = [];
      } finally {
        try {
          await io.send("ATSH7DF");
        } catch {
        }
      }
    }
    return { stored, pending, permanent, uds };
  }
  async function clearDtcs(io) {
    const raw2 = await io.send("04", 8e3);
    if (/\?/.test(raw2) && !/OK/i.test(raw2)) throw new Error("L\xF6schen wurde vom Adapter abgelehnt.");
  }
  function u8(d, i = 0) {
    const v = d[i];
    return v === void 0 ? null : v;
  }
  var PIDS = [
    {
      pid: 5,
      label: "K\xFChlmitteltemperatur",
      chapter: "k4",
      decode: (d) => {
        const a = u8(d);
        if (a === null) return null;
        const t = a - 40;
        const warn = t > 115 || t < -20;
        return {
          text: t + " \xB0C",
          warn,
          note: warn ? "Au\xDFerhalb des \xFCblichen Fensters. Kennlinie in Kapitel K\xFChlmittel." : "Warm liegt ein Motor meist bei 80 bis 105 \xB0C. Kalt ist normal."
        };
      }
    },
    {
      pid: 12,
      label: "Drehzahl",
      chapter: "k5",
      decode: (d) => {
        if (d.length < 2) return null;
        const rpm = (d[0] * 256 + d[1]) / 4;
        return { text: Math.round(rpm) + " 1/min", warn: false, note: "Kommt das Signal nicht, Kurbelwellensensor pr\xFCfen." };
      }
    },
    {
      pid: 13,
      label: "Geschwindigkeit",
      chapter: "k55",
      decode: (d) => {
        const a = u8(d);
        if (a === null) return null;
        return { text: a + " km/h", warn: false, note: "Steht fest auf null w\xE4hrend der Fahrt: Getriebe- oder Raddrehzahl." };
      }
    },
    {
      pid: 15,
      label: "Ansauglufttemperatur",
      chapter: "k12",
      decode: (d) => {
        const a = u8(d);
        if (a === null) return null;
        const t = a - 40;
        return { text: t + " \xB0C", warn: t > 80, note: "Nahe der Au\xDFenluft im Leerlauf. Sehr hoch: Sensor oder Stauluft." };
      }
    },
    {
      pid: 4,
      label: "Motorlast",
      chapter: "k3",
      decode: (d) => {
        const a = u8(d);
        if (a === null) return null;
        const pct = a * 100 / 255;
        return { text: pct.toFixed(0) + " %", warn: false, note: "Zum Vergleich mit Luftmasse und Saugrohrdruck." };
      }
    },
    {
      pid: 6,
      label: "Kurzzeitadaption Bank 1",
      chapter: "k7",
      decode: (d) => {
        const a = u8(d);
        if (a === null) return null;
        const pct = (a - 128) * 100 / 128;
        const warn = Math.abs(pct) > 15;
        return {
          text: (pct >= 0 ? "+" : "") + pct.toFixed(0) + " %",
          warn,
          note: warn ? "Adaption zieht stark. Gemisch, Luftmasse, Druck und Lambdasonde." : "Nahe null ist unauff\xE4llig."
        };
      }
    },
    {
      pid: 11,
      label: "Saugrohrdruck",
      chapter: "k10",
      decode: (d) => {
        const a = u8(d);
        if (a === null) return null;
        return { text: a + " kPa", warn: false, note: "Z\xFCndung ein, Motor aus: nahe Au\xDFenluftdruck. Leerlauf Saugmotor deutlich darunter." };
      }
    },
    {
      pid: 17,
      label: "Drosselklappe",
      chapter: "k9",
      decode: (d) => {
        const a = u8(d);
        if (a === null) return null;
        const pct = a * 100 / 255;
        return { text: pct.toFixed(0) + " %", warn: false, note: "Muss dem Pedal folgen, ohne Spr\xFCnge." };
      }
    },
    {
      pid: 66,
      label: "Steuerger\xE4tespannung",
      chapter: "k102",
      decode: (d) => {
        if (d.length < 2) return null;
        const v = (d[0] * 256 + d[1]) / 1e3;
        const warn = v < 12.2 || v > 15.2;
        return {
          text: v.toFixed(2) + " V",
          warn,
          note: warn ? "Batterie oder Generator pr\xFCfen, dazu das Masseband." : "Laufender Motor meist 13,5 bis 14,8 V."
        };
      }
    }
  ];
  function decodePid(pid, data) {
    const def = PIDS.find((p) => p.pid === pid);
    if (!def) return null;
    const got = def.decode(data);
    if (!got) return null;
    return { pid, label: def.label, chapter: def.chapter, ...got };
  }
  function parsePidResponse(raw2, pid) {
    if (/NO DATA|UNABLE|\?/i.test(raw2) && !/41/.test(raw2)) return null;
    const bytes = payloadAfter(raw2, 65);
    if (!bytes.length || bytes[0] !== pid) return null;
    return bytes.slice(1);
  }
  async function readLive(io) {
    const out = [];
    for (const def of PIDS) {
      const cmd = "01" + def.pid.toString(16).padStart(2, "0").toUpperCase();
      const raw2 = await io.send(cmd, 4e3);
      const data = parsePidResponse(raw2, def.pid);
      if (!data) continue;
      const reading = decodePid(def.pid, data);
      if (reading) out.push(reading);
    }
    return out;
  }
  var LIVE_PIDS = PIDS.map((p) => p.pid);
  var PromptSession = class {
    constructor() {
      __publicField(this, "buf", "");
      __publicField(this, "waiters", []);
      __publicField(this, "chain", Promise.resolve());
    }
    pushText(text) {
      this.buf += text;
      this.drain();
    }
    drain() {
      if (!this.waiters.length) return;
      const i = this.buf.indexOf(">");
      if (i < 0) return;
      const chunk = this.buf.slice(0, i).replace(/\s+$/g, "");
      this.buf = this.buf.slice(i + 1);
      const waiter = this.waiters.shift();
      if (!waiter) return;
      clearTimeout(waiter.timer);
      waiter.resolve(chunk);
      this.drain();
    }
    request(write, command, timeoutMs) {
      const cmd = command.endsWith("\r") ? command : command + "\r";
      const run = () => new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w.resolve !== resolve);
          this.buf = "";
          reject(new Error("Zeit\xFCberschreitung beim Adapter (" + command.trim() + ")."));
        }, timeoutMs);
        this.waiters.push({ resolve, reject, timer });
        void Promise.resolve().then(() => write(cmd)).catch((err) => {
          clearTimeout(timer);
          this.waiters = this.waiters.filter((w) => w.resolve !== resolve);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
      });
      const job = this.chain.then(run, run);
      this.chain = job.then(
        () => void 0,
        () => void 0
      );
      return job;
    }
  };
  function createScriptedElm(answer) {
    return {
      async send(command) {
        const key = command.replace(/\s/g, "").toUpperCase();
        return stripEcho(key, answer(key));
      },
      async close() {
      }
    };
  }
  function demoAnswer(mode, cmd) {
    if (cmd.startsWith("STP")) return mode === "stn-reject" ? "?" : "OK";
    if (cmd === "ATZ") return "ELM327 v1.5";
    if (cmd === "ATDP") return "ISO 15765-4 (CAN 11/500)";
    if (cmd === "ATDPN") return "A6";
    if (cmd.startsWith("AT")) return "OK";
    if (cmd === "0100") return "41 00 BE 3E A8 13";
    if (cmd === "03") return mode === "uds" ? "NO DATA" : "43 04 01 18 03 01 04 20 05 62";
    if (cmd === "07") return mode === "uds" ? "NO DATA" : "47 01 01 34";
    if (cmd === "0A") return mode === "uds" ? "NO DATA" : "4A 01 04 20";
    if (cmd === "190209") return "59 02 09 01 18 33 2F 03 01 00 2F";
    if (cmd === "04") return "OK";
    if (cmd === "0105") return "41 05 A0";
    if (cmd === "010C") return "41 0C 0C 30";
    if (cmd === "010D") return "41 0D 00";
    if (cmd === "010F") return "41 0F 4B";
    if (cmd === "0104") return "41 04 48";
    if (cmd === "0106") return "41 06 97";
    if (cmd === "010B") return "41 0B 64";
    if (cmd === "0111") return "41 11 1A";
    if (cmd === "0142") return "41 42 2B F0";
    return "NO DATA";
  }
  function createDemoElm(mode = "obd") {
    return createScriptedElm((command) => demoAnswer(mode, command));
  }

  // src/obd/link.ts
  function parseWifiTarget(input, fallbackPort) {
    let raw2 = input.trim();
    if (!raw2) return { error: "Adresse fehlt." };
    raw2 = raw2.replace(/^wss?:\/\//i, "").replace(/\/$/, "");
    let host = raw2;
    let port = fallbackPort;
    if (raw2.startsWith("[")) {
      const end = raw2.indexOf("]");
      if (end < 0) return { error: "IPv6-Adresse ist unvollst\xE4ndig." };
      host = raw2.slice(1, end);
      const rest = raw2.slice(end + 1);
      if (rest.startsWith(":")) port = Number(rest.slice(1));
    } else {
      const colon = raw2.lastIndexOf(":");
      if (colon > 0 && /^\d+$/.test(raw2.slice(colon + 1))) {
        host = raw2.slice(0, colon);
        port = Number(raw2.slice(colon + 1));
      }
    }
    if (!host || /[\s/]/.test(host)) return { error: "Adresse nicht lesbar." };
    if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: "Port ung\xFCltig." };
    return { host, port };
  }
  function wifiAttemptPlan(host, port, caps) {
    const plan = [];
    if (caps.tcp) plan.push({ kind: "tcp", target: host + ":" + port });
    plan.push({ kind: "ws", target: "ws://" + host + ":" + port });
    return plan;
  }
  function hasTcpSocket() {
    return typeof globalThis.TCPSocket === "function";
  }
  function hasWebBluetooth() {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }
  async function elmFromWebSocket(url, factory = (u) => new WebSocket(u), timeoutMs = 4e3) {
    const ws = factory(url);
    const session = new PromptSession();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("WLAN-Adapter antwortet nicht auf " + url + "."));
      }, timeoutMs);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Keine WebSocket-Verbindung zu " + url + "."));
      };
      ws.onmessage = (ev) => {
        const data = ev.data;
        if (typeof data === "string") session.pushText(data);
        else if (data instanceof Uint8Array) session.pushText(new TextDecoder().decode(data));
      };
    });
    ws.onclose = () => session.pushText("");
    return {
      send(command, t = 4e3) {
        return session.request((cmd) => ws.send(cmd), command, t);
      },
      async close() {
        ws.close();
      }
    };
  }
  async function connectWifi(input, fallbackPort, deps) {
    var _a, _b;
    const target = parseWifiTarget(input, fallbackPort);
    if ("error" in target) throw new Error(target.error);
    const tcpOk = (_a = deps == null ? void 0 : deps.tcpAvailable) != null ? _a : hasTcpSocket();
    const plan = wifiAttemptPlan(target.host, target.port, { tcp: tcpOk });
    const errors = [];
    for (const step of plan) {
      try {
        if (step.kind === "tcp") {
          const io = (deps == null ? void 0 : deps.tcp) ? await deps.tcp(target.host, target.port) : await openTcpElm(target.host, target.port);
          if (io) return io;
          errors.push("TCP nicht verf\xFCgbar");
          continue;
        }
        const open = (_b = deps == null ? void 0 : deps.ws) != null ? _b : (url) => elmFromWebSocket(url);
        return await open(step.target);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    throw new Error(
      "WLAN-Adapter nicht erreicht (" + errors.filter(Boolean).join(" \xB7 ") + "). Die meisten ELM327-WLAN-Sticks sprechen rohes TCP auf Port 35000, kein WebSocket. Der Browser darf TCP nur \xF6ffnen, wenn er Direktsockets kann. Bluetooth LE oder das Demo-Fahrzeug funktionieren ohne diese Einschr\xE4nkung."
    );
  }
  async function openTcpElm(host, port) {
    const Ctor = globalThis.TCPSocket;
    if (!Ctor) return null;
    const socket = new Ctor(host, port);
    const opened = await socket.opened;
    const session = new PromptSession();
    const reader = opened.readable.getReader();
    const writer = opened.writable.getWriter();
    const decoder = new TextDecoder();
    void (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) session.pushText(decoder.decode(value, { stream: true }));
        }
      } catch {
      }
    })();
    return {
      send(command, timeoutMs = 4e3) {
        return session.request((cmd) => {
          void writer.write(new TextEncoder().encode(cmd));
        }, command, timeoutMs);
      },
      async close() {
        try {
          await writer.close();
        } catch {
        }
        socket.close();
      }
    };
  }
  var BLE_PROFILES = [
    {
      name: "HM-10 und viele ELM327-BLE",
      service: "0000ffe0-0000-1000-8000-00805f9b34fb",
      write: "0000ffe1-0000-1000-8000-00805f9b34fb",
      notify: "0000ffe1-0000-1000-8000-00805f9b34fb"
    },
    {
      name: "Veepeak, OBDLink CX und Klone FFF0",
      service: "0000fff0-0000-1000-8000-00805f9b34fb",
      write: "0000fff2-0000-1000-8000-00805f9b34fb",
      notify: "0000fff1-0000-1000-8000-00805f9b34fb"
    },
    {
      name: "Nordic UART",
      service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
      write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
      notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
    },
    {
      name: "Vgate iCar",
      service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
      write: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
      notify: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f"
    }
  ];
  function normUuid(u) {
    return u.toLowerCase();
  }
  function selectBleChannel(services) {
    const all = services.map((s) => ({ ...s, uuid: normUuid(s.uuid), characteristics: s.characteristics.map((c) => ({ ...c, uuid: normUuid(c.uuid) })) }));
    for (const profile of BLE_PROFILES) {
      const svc = all.find((s) => s.uuid === profile.service || s.uuid.endsWith(profile.service.slice(4, 8)) || s.uuid === shortToFull(profile.service));
      if (!svc) continue;
      const write = svc.characteristics.find((c) => c.uuid === profile.write || c.uuid.endsWith(profile.write.replace(/-/g, "").slice(4, 8)));
      const notify = svc.characteristics.find((c) => c.uuid === profile.notify || c.uuid.endsWith(profile.notify.replace(/-/g, "").slice(4, 8)));
      if (write && notify) return { service: svc.uuid, write: write.uuid, notify: notify.uuid, profile: profile.name };
    }
    for (const svc of all) {
      const notify = svc.characteristics.find((c) => c.properties.notify);
      const write = svc.characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (notify && write) return { service: svc.uuid, write: write.uuid, notify: notify.uuid, profile: "generisch" };
    }
    return null;
  }
  function shortToFull(uuid) {
    return uuid;
  }
  function chunkText(text, size = 20) {
    const out = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
  }
  var BLE_OPTIONAL_SERVICES = BLE_PROFILES.map((p) => p.service);
  var BLE_NAME_PREFIXES = ["OBD", "ELM", "Vgate", "VGATE", "iCar", "OBDBLE", "VEEPEAK", "Veepeak", "V-LINK", "IOS-Vlink", "OBDII", "KONNWEI"];

  // src/obd/bluetooth.ts
  function bluetoothUnavailableReason() {
    if (typeof navigator === "undefined") return "Bluetooth ist nur im Browser verf\xFCgbar.";
    const nav = navigator;
    if (!nav.bluetooth) {
      return "Dieser Browser \xF6ffnet kein Bluetooth. Chrome oder Edge auf einem Rechner oder Android verwenden. Safari auf dem iPhone kann das nicht. Klassisches Bluetooth (SPP) geht im Browser grunds\xE4tzlich nicht, nur Bluetooth LE.";
    }
    return null;
  }
  async function describe(server) {
    const found = [];
    const push = async (svc) => {
      const chars = await svc.getCharacteristics();
      found.push({
        uuid: svc.uuid,
        characteristics: chars.map((c) => ({
          uuid: c.uuid,
          properties: {
            write: !!c.properties.write,
            writeWithoutResponse: !!c.properties.writeWithoutResponse,
            notify: !!c.properties.notify
          }
        }))
      });
    };
    for (const uuid of BLE_OPTIONAL_SERVICES) {
      try {
        await push(await server.getPrimaryService(uuid));
      } catch {
      }
    }
    if (!found.length && server.getPrimaryServices) {
      try {
        for (const svc of await server.getPrimaryServices()) await push(svc);
      } catch {
      }
    }
    return found;
  }
  async function connectBluetooth(acceptAll) {
    const reason = bluetoothUnavailableReason();
    if (reason) throw new Error(reason);
    const nav = navigator;
    const device = await nav.bluetooth.requestDevice(
      acceptAll ? { acceptAllDevices: true, optionalServices: BLE_OPTIONAL_SERVICES } : { filters: BLE_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })), optionalServices: BLE_OPTIONAL_SERVICES }
    );
    const gatt = device.gatt;
    if (!gatt) throw new Error("Keine GATT-Verbindung. Klassisches Bluetooth kann der Browser nicht \xF6ffnen.");
    const server = await gatt.connect();
    const services = await describe(server);
    const channel = selectBleChannel(services);
    if (!channel) {
      server.disconnect();
      throw new Error("Kein serielles BLE-Profil gefunden (FFE0, FFF0, Nordic UART oder Vgate).");
    }
    const svc = await server.getPrimaryService(channel.service);
    const writeChar = await svc.getCharacteristic(channel.write);
    const notifyChar = await svc.getCharacteristic(channel.notify);
    const session = new PromptSession();
    await notifyChar.startNotifications();
    notifyChar.addEventListener("characteristicvaluechanged", (ev) => {
      var _a;
      const value = (_a = ev.target) == null ? void 0 : _a.value;
      if (!value) return;
      session.pushText(new TextDecoder().decode(value.buffer));
    });
    return {
      name: device.name || channel.profile,
      io: {
        send(command, timeoutMs = 6e3) {
          return session.request(async (cmd) => {
            for (const part of chunkText(cmd, 20)) {
              const bytes = new TextEncoder().encode(part);
              if (writeChar.properties.writeWithoutResponse && writeChar.writeValueWithoutResponse) {
                await writeChar.writeValueWithoutResponse(bytes);
              } else await writeChar.writeValue(bytes);
            }
          }, command, timeoutMs);
        },
        async close() {
          server.disconnect();
        }
      }
    };
  }

  // src/obd/native.ts
  init_dist();

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/definitions.js
  var ScanMode;
  (function(ScanMode2) {
    ScanMode2[ScanMode2["SCAN_MODE_LOW_POWER"] = 0] = "SCAN_MODE_LOW_POWER";
    ScanMode2[ScanMode2["SCAN_MODE_BALANCED"] = 1] = "SCAN_MODE_BALANCED";
    ScanMode2[ScanMode2["SCAN_MODE_LOW_LATENCY"] = 2] = "SCAN_MODE_LOW_LATENCY";
  })(ScanMode || (ScanMode = {}));
  var ConnectionPriority;
  (function(ConnectionPriority2) {
    ConnectionPriority2[ConnectionPriority2["CONNECTION_PRIORITY_BALANCED"] = 0] = "CONNECTION_PRIORITY_BALANCED";
    ConnectionPriority2[ConnectionPriority2["CONNECTION_PRIORITY_HIGH"] = 1] = "CONNECTION_PRIORITY_HIGH";
    ConnectionPriority2[ConnectionPriority2["CONNECTION_PRIORITY_LOW_POWER"] = 2] = "CONNECTION_PRIORITY_LOW_POWER";
  })(ConnectionPriority || (ConnectionPriority = {}));

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/bleClient.js
  init_dist();
  init_conversion();

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/plugin.js
  init_dist();
  var BluetoothLe = registerPlugin("BluetoothLe", {
    web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.BluetoothLeWeb())
  });

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/queue.js
  var makeQueue = () => {
    let currentTask = Promise.resolve();
    return (fn) => new Promise((resolve, reject) => {
      currentTask = currentTask.then(() => fn()).then(resolve).catch(reject);
    });
  };
  function getQueue(enabled) {
    if (enabled) {
      return makeQueue();
    }
    return (fn) => fn();
  }

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/validators.js
  function parseUUID(uuid) {
    if (typeof uuid !== "string") {
      throw new Error(`Invalid UUID type ${typeof uuid}. Expected string.`);
    }
    uuid = uuid.toLowerCase();
    const is128BitUuid = uuid.search(/^[0-9a-f]{8}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{12}$/) >= 0;
    if (!is128BitUuid) {
      throw new Error(`Invalid UUID format ${uuid}. Expected 128 bit string (e.g. "0000180d-0000-1000-8000-00805f9b34fb").`);
    }
    return uuid;
  }

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/bleClient.js
  var BleClientClass = class {
    constructor() {
      this.scanListener = null;
      this.eventListeners = /* @__PURE__ */ new Map();
      this.queue = getQueue(true);
    }
    enableQueue() {
      this.queue = getQueue(true);
    }
    disableQueue() {
      this.queue = getQueue(false);
    }
    async initialize(options) {
      await this.queue(async () => {
        await BluetoothLe.initialize(options);
      });
    }
    async isEnabled() {
      const enabled = await this.queue(async () => {
        const result = await BluetoothLe.isEnabled();
        return result.value;
      });
      return enabled;
    }
    async requestEnable() {
      await this.queue(async () => {
        await BluetoothLe.requestEnable();
      });
    }
    async enable() {
      await this.queue(async () => {
        await BluetoothLe.enable();
      });
    }
    async disable() {
      await this.queue(async () => {
        await BluetoothLe.disable();
      });
    }
    async startEnabledNotifications(callback) {
      await this.queue(async () => {
        var _a;
        const key = `onEnabledChanged`;
        await ((_a = this.eventListeners.get(key)) === null || _a === void 0 ? void 0 : _a.remove());
        const listener = await BluetoothLe.addListener(key, (result) => {
          callback(result.value);
        });
        this.eventListeners.set(key, listener);
        await BluetoothLe.startEnabledNotifications();
      });
    }
    async stopEnabledNotifications() {
      await this.queue(async () => {
        var _a;
        const key = `onEnabledChanged`;
        await ((_a = this.eventListeners.get(key)) === null || _a === void 0 ? void 0 : _a.remove());
        this.eventListeners.delete(key);
        await BluetoothLe.stopEnabledNotifications();
      });
    }
    async isLocationEnabled() {
      const enabled = await this.queue(async () => {
        const result = await BluetoothLe.isLocationEnabled();
        return result.value;
      });
      return enabled;
    }
    async openLocationSettings() {
      await this.queue(async () => {
        await BluetoothLe.openLocationSettings();
      });
    }
    async openBluetoothSettings() {
      await this.queue(async () => {
        await BluetoothLe.openBluetoothSettings();
      });
    }
    async openAppSettings() {
      await this.queue(async () => {
        await BluetoothLe.openAppSettings();
      });
    }
    async setDisplayStrings(displayStrings) {
      await this.queue(async () => {
        await BluetoothLe.setDisplayStrings(displayStrings);
      });
    }
    async requestDevice(options) {
      options = options ? this.validateRequestBleDeviceOptions(options) : void 0;
      const result = await this.queue(async () => {
        const device = await BluetoothLe.requestDevice(options);
        return device;
      });
      return result;
    }
    async requestLEScan(options, callback) {
      options = this.validateRequestBleDeviceOptions(options);
      await this.queue(async () => {
        var _a;
        await ((_a = this.scanListener) === null || _a === void 0 ? void 0 : _a.remove());
        this.scanListener = await BluetoothLe.addListener("onScanResult", (resultInternal) => {
          const result = Object.assign(Object.assign({}, resultInternal), { manufacturerData: this.convertObject(resultInternal.manufacturerData), serviceData: this.convertObject(resultInternal.serviceData), rawAdvertisement: resultInternal.rawAdvertisement ? this.convertValue(resultInternal.rawAdvertisement) : void 0 });
          callback(result);
        });
        await BluetoothLe.requestLEScan(options);
      });
    }
    async stopLEScan() {
      await this.queue(async () => {
        var _a;
        await ((_a = this.scanListener) === null || _a === void 0 ? void 0 : _a.remove());
        this.scanListener = null;
        await BluetoothLe.stopLEScan();
      });
    }
    async getDevices(deviceIds) {
      if (!Array.isArray(deviceIds)) {
        throw new Error("deviceIds must be an array");
      }
      return this.queue(async () => {
        const result = await BluetoothLe.getDevices({ deviceIds });
        return result.devices;
      });
    }
    async getConnectedDevices(services) {
      if (!Array.isArray(services)) {
        throw new Error("services must be an array");
      }
      services = services.map(parseUUID);
      return this.queue(async () => {
        const result = await BluetoothLe.getConnectedDevices({ services });
        return result.devices;
      });
    }
    async getBondedDevices() {
      return this.queue(async () => {
        const result = await BluetoothLe.getBondedDevices();
        return result.devices;
      });
    }
    async connect(deviceId, onDisconnect, options) {
      await this.queue(async () => {
        var _a;
        if (onDisconnect) {
          const key = `disconnected|${deviceId}`;
          await ((_a = this.eventListeners.get(key)) === null || _a === void 0 ? void 0 : _a.remove());
          const listener = await BluetoothLe.addListener(key, () => {
            onDisconnect(deviceId);
          });
          this.eventListeners.set(key, listener);
        }
        await BluetoothLe.connect(Object.assign({ deviceId }, options));
      });
    }
    async createBond(deviceId, options) {
      await this.queue(async () => {
        await BluetoothLe.createBond(Object.assign({ deviceId }, options));
      });
    }
    async isBonded(deviceId) {
      const isBonded = await this.queue(async () => {
        const result = await BluetoothLe.isBonded({ deviceId });
        return result.value;
      });
      return isBonded;
    }
    async disconnect(deviceId) {
      await this.queue(async () => {
        await BluetoothLe.disconnect({ deviceId });
      });
    }
    async getServices(deviceId) {
      const services = await this.queue(async () => {
        const result = await BluetoothLe.getServices({ deviceId });
        return result.services;
      });
      return services;
    }
    async discoverServices(deviceId) {
      await this.queue(async () => {
        await BluetoothLe.discoverServices({ deviceId });
      });
    }
    async getMtu(deviceId) {
      const value = await this.queue(async () => {
        const result = await BluetoothLe.getMtu({ deviceId });
        return result.value;
      });
      return value;
    }
    async requestConnectionPriority(deviceId, connectionPriority) {
      await this.queue(async () => {
        await BluetoothLe.requestConnectionPriority({ deviceId, connectionPriority });
      });
    }
    async readRssi(deviceId) {
      const value = await this.queue(async () => {
        const result = await BluetoothLe.readRssi({ deviceId });
        return parseFloat(result.value);
      });
      return value;
    }
    async read(deviceId, service, characteristic, options) {
      service = parseUUID(service);
      characteristic = parseUUID(characteristic);
      const value = await this.queue(async () => {
        const result = await BluetoothLe.read(Object.assign({
          deviceId,
          service,
          characteristic
        }, options));
        return this.convertValue(result.value);
      });
      return value;
    }
    async write(deviceId, service, characteristic, value, options) {
      service = parseUUID(service);
      characteristic = parseUUID(characteristic);
      return this.queue(async () => {
        if (!(value === null || value === void 0 ? void 0 : value.buffer)) {
          throw new Error("Invalid data.");
        }
        let writeValue = value;
        if (Capacitor.getPlatform() !== "web") {
          writeValue = dataViewToHexString(value);
        }
        await BluetoothLe.write(Object.assign({
          deviceId,
          service,
          characteristic,
          value: writeValue
        }, options));
      });
    }
    async writeWithoutResponse(deviceId, service, characteristic, value, options) {
      service = parseUUID(service);
      characteristic = parseUUID(characteristic);
      await this.queue(async () => {
        if (!(value === null || value === void 0 ? void 0 : value.buffer)) {
          throw new Error("Invalid data.");
        }
        let writeValue = value;
        if (Capacitor.getPlatform() !== "web") {
          writeValue = dataViewToHexString(value);
        }
        await BluetoothLe.writeWithoutResponse(Object.assign({
          deviceId,
          service,
          characteristic,
          value: writeValue
        }, options));
      });
    }
    async readDescriptor(deviceId, service, characteristic, descriptor, options) {
      service = parseUUID(service);
      characteristic = parseUUID(characteristic);
      descriptor = parseUUID(descriptor);
      const value = await this.queue(async () => {
        const result = await BluetoothLe.readDescriptor(Object.assign({
          deviceId,
          service,
          characteristic,
          descriptor
        }, options));
        return this.convertValue(result.value);
      });
      return value;
    }
    async writeDescriptor(deviceId, service, characteristic, descriptor, value, options) {
      service = parseUUID(service);
      characteristic = parseUUID(characteristic);
      descriptor = parseUUID(descriptor);
      return this.queue(async () => {
        if (!(value === null || value === void 0 ? void 0 : value.buffer)) {
          throw new Error("Invalid data.");
        }
        let writeValue = value;
        if (Capacitor.getPlatform() !== "web") {
          writeValue = dataViewToHexString(value);
        }
        await BluetoothLe.writeDescriptor(Object.assign({
          deviceId,
          service,
          characteristic,
          descriptor,
          value: writeValue
        }, options));
      });
    }
    async startNotifications(deviceId, service, characteristic, callback) {
      service = parseUUID(service);
      characteristic = parseUUID(characteristic);
      await this.queue(async () => {
        var _a;
        const key = `notification|${deviceId}|${service}|${characteristic}`;
        await ((_a = this.eventListeners.get(key)) === null || _a === void 0 ? void 0 : _a.remove());
        const listener = await BluetoothLe.addListener(key, (event) => {
          callback(this.convertValue(event === null || event === void 0 ? void 0 : event.value));
        });
        this.eventListeners.set(key, listener);
        await BluetoothLe.startNotifications({
          deviceId,
          service,
          characteristic
        });
      });
    }
    async stopNotifications(deviceId, service, characteristic) {
      service = parseUUID(service);
      characteristic = parseUUID(characteristic);
      await this.queue(async () => {
        var _a;
        const key = `notification|${deviceId}|${service}|${characteristic}`;
        await ((_a = this.eventListeners.get(key)) === null || _a === void 0 ? void 0 : _a.remove());
        this.eventListeners.delete(key);
        await BluetoothLe.stopNotifications({
          deviceId,
          service,
          characteristic
        });
      });
    }
    validateRequestBleDeviceOptions(options) {
      if (options.services) {
        options.services = options.services.map(parseUUID);
      }
      if (options.optionalServices) {
        options.optionalServices = options.optionalServices.map(parseUUID);
      }
      return options;
    }
    convertValue(value) {
      if (typeof value === "string") {
        return hexStringToDataView(value);
      } else if (value === void 0) {
        return new DataView(new ArrayBuffer(0));
      }
      return value;
    }
    convertObject(obj) {
      if (obj === void 0) {
        return void 0;
      }
      const result = {};
      for (const key of Object.keys(obj)) {
        result[key] = this.convertValue(obj[key]);
      }
      return result;
    }
  };
  var BleClient = new BleClientClass();

  // node_modules/@capacitor-community/bluetooth-le/dist/esm/index.js
  init_conversion();

  // src/obd/native.ts
  var sessions = /* @__PURE__ */ new Map();
  var closers = /* @__PURE__ */ new Map();
  var raw;
  function getRaw() {
    if (raw !== void 0) return raw;
    raw = null;
    const g = globalThis;
    if (g.JCDesktop) {
      const d = g.JCDesktop;
      raw = {
        open: (o) => o.kind === "tcp" ? d.tcpOpen(o.host || "", o.port || 35e3) : Promise.reject(new Error("Klassisches Bluetooth: am Rechner als COM-Port koppeln und \u201EUSB / COM\u201C w\xE4hlen.")),
        write: (id, t) => d.write(id, t),
        close: (id) => d.close(id),
        onData: (cb) => d.onData(cb),
        onClosed: (cb) => d.onClosed(cb)
      };
    } else if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      const p = registerPlugin("JCLink");
      raw = {
        open: async (o) => (await p.open(o)).id,
        write: (id, text) => p.write({ id, text }),
        close: (id) => p.close({ id }),
        listBonded: async () => (await p.listBonded()).devices,
        onData: (cb) => void p.addListener("data", (d) => cb(d.id, d.text || "")),
        onClosed: (cb) => void p.addListener("closed", (d) => cb(d.id))
      };
    }
    if (raw) {
      raw.onData((id, text) => {
        var _a;
        return (_a = sessions.get(id)) == null ? void 0 : _a.pushText(text);
      });
      raw.onClosed((id) => {
        var _a;
        sessions.delete(id);
        (_a = closers.get(id)) == null ? void 0 : _a();
      });
    }
    return raw;
  }
  function nativeCaps() {
    const g = globalThis;
    if (g.JCDesktop) return { app: "desktop", spp: false, tcp: true, ble: false };
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return { app: "android", spp: true, tcp: true, ble: true };
    return { app: null, spp: false, tcp: false, ble: false };
  }
  function ioFor(r, id, session, timeoutDefault) {
    sessions.set(id, session);
    return {
      send(command, timeoutMs = timeoutDefault) {
        return session.request((cmd) => r.write(id, cmd), command, timeoutMs);
      },
      async close() {
        closers.delete(id);
        sessions.delete(id);
        try {
          await r.close(id);
        } catch {
        }
      }
    };
  }
  async function connectTcpNative(host, port) {
    const r = getRaw();
    if (!r) throw new Error("TCP-Verbindung gibt es nur in der Android-App oder in der Windows-App.");
    const id = await r.open({ kind: "tcp", host, port });
    return { io: ioFor(r, id, new PromptSession(), 6e3), name: "WLAN " + host + ":" + port };
  }
  async function connectSppNative(pick) {
    const r = getRaw();
    if (!r || !r.listBonded) throw new Error("Klassisches Bluetooth gibt es nur in der Android-App. Am Rechner: Adapter in Windows koppeln und \u201EUSB / COM\u201C w\xE4hlen.");
    const list = await r.listBonded();
    if (!list.length) throw new Error("Kein gekoppeltes Bluetooth-Ger\xE4t gefunden. Zuerst in den Android-Einstellungen unter Bluetooth den ELM327 koppeln (PIN 1234 oder 0000), dann hier w\xE4hlen.");
    const sel = await pick("Gekoppeltes Bluetooth-Ger\xE4t", list.map((d) => ({ id: d.address, label: d.name || d.address, sub: d.address })));
    if (!sel) throw new Error("Abgebrochen.");
    const id = await r.open({ kind: "spp", address: sel });
    const dev = list.find((d) => d.address === sel);
    return { io: ioFor(r, id, new PromptSession(), 6e3), name: "Bluetooth " + ((dev == null ? void 0 : dev.name) || sel) };
  }
  async function connectBleNative() {
    var _a, _b;
    if (nativeCaps().app !== "android") throw new Error("Native BLE nur in der Android-App.");
    await BleClient.initialize({ androidNeverForLocation: true });
    const device = await BleClient.requestDevice({ optionalServices: BLE_OPTIONAL_SERVICES });
    const id = device.deviceId;
    const session = new PromptSession();
    await BleClient.connect(id, () => session.pushText(">"), { timeout: 1e4 });
    const raw2 = await BleClient.getServices(id);
    const services = raw2.map((s) => ({
      uuid: s.uuid,
      characteristics: s.characteristics.map((c) => ({
        uuid: c.uuid,
        properties: { write: !!c.properties.write, writeWithoutResponse: !!c.properties.writeWithoutResponse, notify: !!c.properties.notify }
      }))
    }));
    const ch2 = selectBleChannel(services);
    if (!ch2) {
      await BleClient.disconnect(id);
      throw new Error("Kein serielles BLE-Profil gefunden (FFE0, FFF0, Nordic UART oder Vgate).");
    }
    const props = (_b = (_a = services.find((s) => s.uuid === ch2.service)) == null ? void 0 : _a.characteristics.find((c) => c.uuid === ch2.write)) == null ? void 0 : _b.properties;
    const dec = new TextDecoder();
    await BleClient.startNotifications(id, ch2.service, ch2.notify, (v) => {
      session.pushText(dec.decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)));
    });
    const enc = new TextEncoder();
    return {
      name: device.name || ch2.profile,
      io: {
        send(command, timeoutMs = 6e3) {
          return session.request(async (cmd) => {
            for (const part of chunkText(cmd, 20)) {
              const b = enc.encode(part);
              const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
              if (props == null ? void 0 : props.writeWithoutResponse) await BleClient.writeWithoutResponse(id, ch2.service, ch2.write, dv);
              else await BleClient.write(id, ch2.service, ch2.write, dv);
            }
          }, command, timeoutMs);
        },
        async close() {
          try {
            await BleClient.disconnect(id);
          } catch {
          }
        }
      }
    };
  }

  // src/entry.ts
  function serialUnavailableReason() {
    const nav = navigator;
    if (!nav.serial) return "Web Serial fehlt: nur Chrome oder Edge am Rechner (Windows, macOS, Linux).";
    return null;
  }
  async function connectSerial(baud = 38400) {
    const r = serialUnavailableReason();
    if (r) throw new Error(r);
    const nav = navigator;
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: baud });
    const session = new PromptSession();
    const reader = port.readable.getReader();
    const writer = port.writable.getWriter();
    let alive = true;
    (async () => {
      const dec = new TextDecoder();
      while (alive) {
        try {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) session.pushText(dec.decode(value));
        } catch {
          break;
        }
      }
    })();
    const enc = new TextEncoder();
    return {
      name: "Serial " + baud + " Bd",
      io: {
        send(command, timeoutMs = 6e3) {
          return session.request(async (cmd) => {
            await writer.write(enc.encode(cmd));
          }, command, timeoutMs);
        },
        async close() {
          alive = false;
          try {
            await reader.cancel();
          } catch {
          }
          try {
            reader.releaseLock();
            writer.releaseLock();
          } catch {
          }
          try {
            await port.close();
          } catch {
          }
        }
      }
    };
  }
  return __toCommonJS(entry_exports);
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
