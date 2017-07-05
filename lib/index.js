'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _smashcastWs = require('./smashcast-ws');

var _smashcastWs2 = _interopRequireDefault(_smashcastWs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (!global.XMLHttpRequest) {
    // make rxjs ajax work in node
    global.XMLHttpRequest = require('xhr2'); // eslint-disable-line global-require
}

exports.default = new _smashcastWs2.default();
//# sourceMappingURL=index.js.map
