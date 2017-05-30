import { supportsWebSockets } from './utils/utils';

export const SERVER_LIST_API = 'https://www.smashcast.tv/api/chat/servers.json';
export const FALLBACK_SERVER = 'https://fallback.ws.smashcast.tv';
export const SOCKET_IO_CONFIG = {
    'force new connection': true,
    'reconnection': false,
    'timeout': 16 * 1000,
    'httpCompression': false,
    'perMessageDeflate': false,
    'transports': ['websocket'],
};

if (!supportsWebSockets()) {
    Object.assign(SOCKET_IO_CONFIG, {
        transports: ['polling'],
        upgrade: false,
        transportOptions: {
            requestTimeout: 60 * 1000,
        },
    });
}
