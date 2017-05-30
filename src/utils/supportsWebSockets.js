import isBrowser from './isBrowser';

export default function supportsWebSockets() {
    return (isBrowser() && 'WebSocket' in window) || !isBrowser();
}
