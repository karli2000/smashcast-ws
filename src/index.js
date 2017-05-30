import SmashcastWs from './smashcast-ws';

if (!global.XMLHttpRequest) { // make rxjs ajax work in node
    global.XMLHttpRequest = require('xhr2'); // eslint-disable-line global-require
}

export default new SmashcastWs();
