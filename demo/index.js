const SmashcastWs = require('../lib/smashcast-ws').default;

const smashcastWs = new SmashcastWs();

smashcastWs.on('chatMsg', console.log);
smashcastWs.on('serverChange', server => {
    console.log(`Selected server: ${server}`);
});

smashcastWs.on('error', () => {
    console.log(arguments);
});

smashcastWs.on('open', () => {
    const params = {
        name: 'UnknownSoldier',
        channel: 'karli',
        token: null,
        hideBuffered: false,
    };

    console.log('connection opened');

    smashcastWs.sendMessage('chat.joinChannel', params);
});
