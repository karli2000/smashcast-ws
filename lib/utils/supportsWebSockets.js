'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = supportsWebSockets;

var _isBrowser = require('./isBrowser');

var _isBrowser2 = _interopRequireDefault(_isBrowser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function supportsWebSockets() {
    return (0, _isBrowser2.default)() && 'WebSocket' in window || !(0, _isBrowser2.default)();
}
//# sourceMappingURL=supportsWebSockets.js.map
