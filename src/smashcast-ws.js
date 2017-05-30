import sample from 'lodash/sample';
import isString from 'lodash/isString';
import without from 'lodash/without';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/dom/ajax';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/retryWhen';

import io from 'socket.io-client';
import { EventEmitter } from 'events';
import { supportsWebSockets } from './utils/utils';
import { SERVER_LIST_API, FALLBACK_SERVER, SOCKET_IO_CONFIG } from './config';

export default class SmashcastWs extends EventEmitter {

    servers = [];
    messagesQueue = [];
    currentServer = '';
    connectionServerRetryLimit = 3;
    autoReConnect = true;
    connectionTries = 0;

    constructor() {
        super();
        this.reconnect();
    }

    reconnect() {
        getServersObservable()
            .first()
            .subscribe(servers => {
                this.servers = servers.map(server => normalizeServerAddress(server));
                this.connectWs(sample(this.servers));
            }, console.error);

        function getServersObservable() {
            if (!supportsWebSockets()) {
                return Observable
                    .of([FALLBACK_SERVER])
                    .delay(0); // make it async
            }

            return Observable
                .ajax({
                    method: 'GET',
                    url: SERVER_LIST_API,
                    timeout: 10000,
                    responseType: 'json',
                })
                .retryWhen(e => e.delay(6000))
                .map(data => data.response)
                .map(servers => servers.map(server => server.server_ip));
        }
    }

    connectWs(serverAddress) {
        this.increaseConnectionTries();
        this.emit('serverChange', serverAddress);
        this.currentServer = serverAddress;
        this.socket = io.connect(serverAddress, SOCKET_IO_CONFIG);

        this.registerEventListeners();
    }

    disconnect() {
        this.messagesQueue.length = 0;
        this.socket.disconnect();
    }

    sendMessage(target, params) {
        if (this.isConnected()) {
            sendMessageNow.call(this);
        } else {
            sendMessageOnceItsConnected.call(this);
        }

        function sendMessageNow() {
            const socketParams = {
                params,
                method: target,
            };

            const targets = target.split('.');
            if (targets.length > 1) {
                socketParams.service = targets.shift();
                socketParams.method = targets.shift();
            }

            this.socket.emit('message', socketParams);
        }

        function sendMessageOnceItsConnected() {
            this.messagesQueue.push({
                target,
                params,
            });
        }
    }

    registerEventListeners() {
        this.socket.once('connect', () => {
            this.emit('open');
        });

        this.once('open', () => {
            while (this.messagesQueue.length) {
                const messageToSend = this.messagesQueue.shift();
                this.sendMessage(messageToSend.target, messageToSend.params);
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
                    const willReconnectTo = sample(without(this.servers, this.currentServer)) || this.currentServer;
                    this.connectWs(willReconnectTo);
                } else {
                    this.resetConnectionTries();
                    this.reconnect();
                }
            }
        }

        this.socket.on('message', data => {
            if (!isString(data)) { // todo fix tests with outgoing messages
                return;
            }

            const parsed = JSON.parse(data);
            let method = parsed.method;

            if (parsed.service) {
                method = `${parsed.service}.${method}`;
            }

            this.emit(method, parsed.params);
        });
    }

    increaseConnectionTries() {
        this.connectionTries += 1;
    }

    resetConnectionTries() {
        this.connectionTries = 0;
    }

    off(event, callback) {
        this.removeListener(event, callback);
    }

    on(event, callback) {
        super.on(event, callback);

        if (event === 'open' && this.isConnected()) {
            setTimeout(() => callback());
        }
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }

    observe(eventName) {
        return Observable.fromEvent(this, eventName);
    }
}


function normalizeServerAddress(address) {
    if (!address.startsWith('https://')) {
        return `https://${address}`;
    }

    return address;
}
