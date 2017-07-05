'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.SOCKET_IO_CONFIG = exports.FALLBACK_SERVER = exports.SERVER_LIST_API = undefined;

var _utils = require('./utils/utils');

var SERVER_LIST_API = exports.SERVER_LIST_API = 'https://www.smashcast.tv/api/chat/servers.json';
var FALLBACK_SERVER = exports.FALLBACK_SERVER = 'https://fallback.ws.smashcast.tv';
var SOCKET_IO_CONFIG = exports.SOCKET_IO_CONFIG = {
    'force new connection': true,
    'reconnection': false,
    'timeout': 16 * 1000,
    'httpCompression': false,
    'perMessageDeflate': false,
    'transports': ['websocket']
};

if (!(0, _utils.supportsWebSockets)()) {
    Object.assign(SOCKET_IO_CONFIG, {
        transports: ['polling'],
        upgrade: false,
        transportOptions: {
            requestTimeout: 60 * 1000
        }
    });
}
//# sourceMappingURL=config.js.map
