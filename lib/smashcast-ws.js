'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _sample = require('lodash/sample');

var _sample2 = _interopRequireDefault(_sample);

var _isString = require('lodash/isString');

var _isString2 = _interopRequireDefault(_isString);

var _without = require('lodash/without');

var _without2 = _interopRequireDefault(_without);

var _Observable = require('rxjs/Observable');

require('rxjs/add/observable/dom/ajax');

require('rxjs/add/observable/of');

require('rxjs/add/observable/fromEvent');

require('rxjs/add/operator/delay');

require('rxjs/add/operator/first');

require('rxjs/add/operator/map');

require('rxjs/add/operator/retryWhen');

var _socket = require('socket.io-client');

var _socket2 = _interopRequireDefault(_socket);

var _events = require('events');

var _utils = require('./utils/utils');

var _config = require('./config');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SmashcastWs = function (_EventEmitter) {
    _inherits(SmashcastWs, _EventEmitter);

    function SmashcastWs() {
        _classCallCheck(this, SmashcastWs);

        var _this = _possibleConstructorReturn(this, (SmashcastWs.__proto__ || Object.getPrototypeOf(SmashcastWs)).call(this));

        _this.servers = [];
        _this.messagesQueue = [];
        _this.currentServer = '';
        _this.connectionServerRetryLimit = 3;
        _this.autoReConnect = true;
        _this.connectionTries = 0;

        _this.reconnect();
        return _this;
    }

    _createClass(SmashcastWs, [{
        key: 'reconnect',
        value: function reconnect() {
            var _this2 = this;

            getServersObservable().first().subscribe(function (servers) {
                _this2.servers = servers.map(function (server) {
                    return normalizeServerAddress(server);
                });
                _this2.connectWs((0, _sample2.default)(_this2.servers));
            }, console.error);

            function getServersObservable() {
                if (!(0, _utils.supportsWebSockets)()) {
                    return _Observable.Observable.of([_config.FALLBACK_SERVER]).delay(0); // make it async
                }

                return _Observable.Observable.ajax({
                    method: 'GET',
                    url: _config.SERVER_LIST_API,
                    timeout: 10000,
                    responseType: 'json'
                }).retryWhen(function (e) {
                    return e.delay(6000);
                }).map(function (data) {
                    return data.response;
                }).map(function (servers) {
                    return servers.map(function (server) {
                        return server.server_ip;
                    });
                });
            }
        }
    }, {
        key: 'connectWs',
        value: function connectWs(serverAddress) {
            this.increaseConnectionTries();
            this.emit('serverChange', serverAddress);
            this.currentServer = serverAddress;
            this.socket = _socket2.default.connect(serverAddress, _config.SOCKET_IO_CONFIG);

            this.registerEventListeners();
        }
    }, {
        key: 'disconnect',
        value: function disconnect() {
            this.messagesQueue.length = 0;
            this.socket.disconnect();
        }
    }, {
        key: 'sendMessage',
        value: function sendMessage(target, params) {
            if (this.isConnected()) {
                sendMessageNow.call(this);
            } else {
                sendMessageOnceItsConnected.call(this);
            }

            function sendMessageNow() {
                var socketParams = {
                    params: params,
                    method: target
                };

                var targets = target.split('.');
                if (targets.length > 1) {
                    socketParams.service = targets.shift();
                    socketParams.method = targets.shift();
                }

                this.socket.emit('message', socketParams);
            }

            function sendMessageOnceItsConnected() {
                this.messagesQueue.push({
                    target: target,
                    params: params
                });
            }
        }
    }, {
        key: 'registerEventListeners',
        value: function registerEventListeners() {
            var _this3 = this;

            this.socket.once('connect', function () {
                _this3.emit('open');
            });

            this.once('open', function () {
                while (_this3.messagesQueue.length) {
                    var messageToSend = _this3.messagesQueue.shift();
                    _this3.sendMessage(messageToSend.target, messageToSend.params);
                }
            });

            this.socket.once('disconnect', onDrop.bind(this));

            this.socket.once('connect_timeout', onDrop.bind(this));

            this.socket.once('error', onDrop.bind(this));

            function onDrop(reason) {
                this.emit('close');

                if (!this.autoReConnect) {
                    return;
                }

                if (reason === 'io server disconnect') {
                    setTimeout(handleReconnect.bind(this), 5000);
                } else {
                    handleReconnect.call(this);
                }

                function handleReconnect() {
                    if (this.connectionTries < this.connectionServerRetryLimit) {
                        var willReconnectTo = (0, _sample2.default)((0, _without2.default)(this.servers, this.currentServer)) || this.currentServer;
                        this.connectWs(willReconnectTo);
                    } else {
                        this.resetConnectionTries();
                        this.reconnect();
                    }
                }
            }

            this.socket.on('message', function (data) {
                if (!(0, _isString2.default)(data)) {
                    // todo fix tests with outgoing messages
                    return;
                }

                var parsed = JSON.parse(data);
                var method = parsed.method;

                if (parsed.service) {
                    method = parsed.service + '.' + method;
                }

                _this3.emit(method, parsed.params);
            });
        }
    }, {
        key: 'increaseConnectionTries',
        value: function increaseConnectionTries() {
            this.connectionTries += 1;
        }
    }, {
        key: 'resetConnectionTries',
        value: function resetConnectionTries() {
            this.connectionTries = 0;
        }
    }, {
        key: 'off',
        value: function off(event, callback) {
            this.removeListener(event, callback);
        }
    }, {
        key: 'on',
        value: function on(event, callback) {
            _get(SmashcastWs.prototype.__proto__ || Object.getPrototypeOf(SmashcastWs.prototype), 'on', this).call(this, event, callback);

            if (event === 'open' && this.isConnected()) {
                setTimeout(function () {
                    return callback();
                });
            }
        }
    }, {
        key: 'isConnected',
        value: function isConnected() {
            return this.socket && this.socket.connected;
        }
    }, {
        key: 'observe',
        value: function observe(eventName) {
            return _Observable.Observable.fromEvent(this, eventName);
        }
    }]);

    return SmashcastWs;
}(_events.EventEmitter);

exports.default = SmashcastWs;


function normalizeServerAddress(address) {
    if (!address.startsWith('https://')) {
        return 'https://' + address;
    }

    return address;
}
//# sourceMappingURL=smashcast-ws.js.map
