import { expect, sinon, chai } from 'cafeteria'; // eslint-disable-line import/no-extraneous-dependencies
import chaiAsPromised from 'chai-as-promised'; // eslint-disable-line import/no-extraneous-dependencies
import proxyquire from 'proxyquire'; // eslint-disable-line import/no-extraneous-dependencies
import io from 'socket.io-client';
import { EventEmitter } from 'events';
import SmashcastWs from './smashcast-ws';
import * as utils from './utils/utils';
import { SERVER_LIST_API, FALLBACK_SERVER, SOCKET_IO_CONFIG } from './config';

chai.use(chaiAsPromised);

describe('smashcastWs', function testSuite() {
    const serversResponse = [
        { server_ip: 'ec2-54-157-44-89.ch.smashcast.tv' },
        { server_ip: 'ec2-54-234-172-234.ch.smashcast.tv' },
        { server_ip: 'ec2-54-198-35-11.ch.smashcast.tv' },
        { server_ip: 'ec2-54-196-212-17.ch.smashcast.tv' },
        { server_ip: 'ec2-54-81-102-6.ch.smashcast.tv' },
    ];
    let sandbox;
    let socket;
    let xhr;

    beforeEach(function beforeEach() {
        sandbox = sinon.sandbox.create();
        socket = new EventEmitter();
        socket.disconnect = () => {
            resetSocketConnectedState();
            socket.emit('disconnect');
        };

        socket.on('disconnect', resetSocketConnectedState);
        socket.on('connect_timeout', resetSocketConnectedState);
        socket.on('error', resetSocketConnectedState);

        sandbox.stub(io, 'connect').callsFake(() => {
            setTimeout(() => {
                socket.connected = true;
                socket.emit('connect');
            });

            return socket;
        });

        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = request => {
            setTimeout(() => {
                if (request.url === SERVER_LIST_API) {
                    request.respond(200, { 'Content-Type': 'application/json' }, JSON.stringify(serversResponse));
                }
            });
        };
        global.XMLHttpRequest = xhr;

        function resetSocketConnectedState() {
            socket.connected = false;
        }
    });

    afterEach(function beforeEach() {
        sandbox.restore();
        global.XMLHttpRequest.restore();
    });

    it('should exist', function testCase() {
        expect(SmashcastWs).to.be.a('function');
    });

    it('should store queried ws servers in a cache-like array with prepended protocol', function testCase() {
        const smashcastWs = new SmashcastWs();

        const servers = new Promise(resolve => {
            smashcastWs.on('serverChange', () => resolve(smashcastWs.servers));
        });

        return expect(servers).to.eventually.eql(serversResponse.map(server => `https://${server.server_ip}`));
    });

    it('should randomly pick a ws server', function testCase() {
        const firstServer = `https://${serversResponse[1].server_ip}`;
        const secondServer = `https://${serversResponse[3].server_ip}`;
        const sampleStub = sandbox.stub();

        sampleStub.onCall(0).returns(firstServer);
        sampleStub.onCall(1).returns(secondServer);

        const SmashcastWs = proxyquire('./smashcast-ws', { // eslint-disable-line no-shadow
            'lodash/sample': sampleStub,
        }).default;

        const smashcastWs = new SmashcastWs();

        const openFirst = new Promise(resolve => {
            smashcastWs.on('serverChange', resolve);
        });

        const smashcastWs2 = new SmashcastWs();
        const openSecond = new Promise(resolve => {
            smashcastWs2.on('serverChange', resolve);
        });

        return Promise.all([
            expect(openFirst).to.eventually.equal(firstServer),
            expect(openSecond).to.eventually.equal(secondServer),
        ]);
    });

    it('should not pick the same server again upon reconnect', function testCase(done) {
        const smashcastWs = new SmashcastWs();
        sandbox.spy(smashcastWs, 'emit');

        let firstConnect = true;
        let firstServer;
        let secondServer;

        smashcastWs.once('open', () => {
            smashcastWs.disconnect();
        });

        smashcastWs.on('serverChange', server => {
            if (firstConnect) {
                firstServer = server;
                firstConnect = false;
            } else {
                secondServer = server;
                expect(firstServer).not.to.be.equal(secondServer);
                done();
            }
        });
    });

    it('should use fallback server if websockets are not supported', function testCase() {
        sandbox.stub(utils, 'supportsWebSockets').returns(false);
        const smashcastWs = new SmashcastWs();

        const server = new Promise(resolve => {
            smashcastWs.on('serverChange', resolve);
        });

        return expect(server).to.eventually.equal(FALLBACK_SERVER);
    });

    it('should have an off method and actually remove an eventlistener', function testCase() {
        const smashcastWs = new SmashcastWs();
        const testCallback = sinon.spy();

        expect(smashcastWs.off).to.be.a('function');

        smashcastWs.on('testEvent', testCallback);
        smashcastWs.off('testEvent', testCallback);

        smashcastWs.emit('testEvent');
        expect(testCallback).to.not.have.been.called();
    });

    describe('with socketIO', function socketIOTestSuite() {
        it('should connect to our ws server', function testCase() {
            const smashcastWs = new SmashcastWs();
            const connected = new Promise(resolve => {
                smashcastWs.on('open', resolve);
            });

            return connected.then(() => {
                expect(io.connect).to.have.been.calledWith(sinon.match.string, SOCKET_IO_CONFIG);
            });
        });

        it('should invoke open callback immediately if it is already connected to our ws server', function testCase() {
            const callbackSpy = sandbox.spy();
            const smashcastWs = new SmashcastWs();
            smashcastWs.on('open', () => {
                smashcastWs.on('open', callbackSpy);
            });

            return expect(callbackSpy).to.eventually.have.been.calledOnce;
        });

        it('should try to connect to a server 3 times only and then refetch the server list', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            const reconnectSpy = sandbox.spy(smashcastWs, 'reconnect');

            smashcastWs.on('open', () => {
                if (!reconnectSpy.calledOnce) {
                    smashcastWs.socket.emit('error');
                }
            });

            smashcastWs.on('close', () => {
                if (smashcastWs.connectionTries !== 3) {
                    return;
                }

                smashcastWs.once('open', () => {
                    expect(smashcastWs.connectionTries).to.equal(1);
                    done();
                });
            });
        });

        it('should disconnect from our ws server', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            smashcastWs.autoReConnect = false;
            sandbox.spy(socket, 'disconnect');

            smashcastWs.on('open', () => smashcastWs.disconnect());
            smashcastWs.on('close', done);

            return expect(socket.disconnect).to.eventually.have.been.calledOnce;
        });

        it('should reconnect to another ws server if connection was dropped', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            let firstCall = true;
            sandbox.spy(smashcastWs, 'connectWs');

            smashcastWs.on('open', () => {
                if (firstCall) {
                    socket.emit('disconnect');
                    firstCall = false;
                } else {
                    expect(smashcastWs.connectWs).to.have.been.calledTwice();
                    done();
                }
            });
        });

        it('should be able to send a message to the server', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            smashcastWs.on('open', () => {
                sandbox.spy(socket, 'emit');

                smashcastWs.sendMessage('testEvent', {
                    testing: true,
                });
                smashcastWs.sendMessage('secondTestEvent', {
                    param: 'lobab',
                });

                expect(socket.emit).have.been.calledWith('message', {
                    method: 'testEvent',
                    params: {
                        testing: true,
                    },
                });
                expect(socket.emit).have.been.calledWith('message', {
                    method: 'secondTestEvent',
                    params: {
                        param: 'lobab',
                    },
                });
                expect(socket.emit).have.been.calledTwice();
                done();
            });
        });

        it('should should invoke a callback on a specified event', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            const callbackSpy = sandbox.spy();

            smashcastWs.on('customEvent', callbackSpy);
            smashcastWs.on('open', () => {
                socket.emit('message', JSON.stringify({ method: 'customEvent', params: { testParam: true } }));
                socket.emit('message', JSON.stringify({ method: 'customEvent', params: { testParam2: false } }));

                expect(callbackSpy).have.been.calledTwice();
                expect(callbackSpy).have.been.calledWith({ testParam: true });
                expect(callbackSpy).have.been.calledWith({ testParam2: false });

                done();
            });
        });

        it('should should invoke a callback on a specified event from a specified service', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            const callbackSpy = sandbox.spy();

            smashcastWs.on('testService.customEvent', callbackSpy);
            smashcastWs.on('anotherService.testEvent', callbackSpy);
            smashcastWs.on('open', () => {
                socket.emit('message', JSON.stringify({
                    service: 'testService',
                    method: 'customEvent',
                    params: { testParam: true },
                }));
                socket.emit('message', JSON.stringify({
                    service: 'anotherService',
                    method: 'testEvent',
                    params: { testParam2: false },
                }));

                expect(callbackSpy).have.been.calledTwice();
                expect(callbackSpy).have.been.calledWith({ testParam: true });
                expect(callbackSpy).have.been.calledWith({ testParam2: false });

                done();
            });
        });

        it('should be able to send a message to the selected service', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            smashcastWs.on('open', () => {
                sandbox.spy(socket, 'emit');

                smashcastWs.sendMessage('testService.testEvent', {
                    testing: true,
                });
                smashcastWs.sendMessage('secondTestService.testEvent2', {
                    param: 'lobab',
                });

                expect(socket.emit).have.been.calledWith('message', {
                    service: 'testService',
                    method: 'testEvent',
                    params: {
                        testing: true,
                    },
                });
                expect(socket.emit).have.been.calledWith('message', {
                    service: 'secondTestService',
                    method: 'testEvent2',
                    params: {
                        param: 'lobab',
                    },
                });
                expect(socket.emit).have.been.calledTwice();
                done();
            });
        });

        it('should send messages just after it is connected', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            sandbox.spy(socket, 'emit');

            smashcastWs.sendMessage('testEvent', {
                testing: true,
            });
            smashcastWs.sendMessage('testEvent2', {
                testing: true,
            });

            smashcastWs.on('open', () => {
                setTimeout(() => { // first might be the joinchannel
                    expect(socket.emit).have.been.calledThrice(); // first is 'connect'
                    done();
                });
            });
        });
    });

    describe('with rxjs', function rxTestSuite() {
        it('should support observables', function testCase(done) {
            const smashcastWs = new SmashcastWs();
            const observable$ = smashcastWs.observe('test');

            observable$.subscribe(done);
            smashcastWs.emit('test');
        });
    });
});
