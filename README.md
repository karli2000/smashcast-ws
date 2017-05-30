# smashcast-ws

## Install

```sh
$ npm i -S smashcast-ws
```

## How to use

### Import smashcastWs
```javascript
import smashcastWs from 'smashcast-ws';
```
### Send a message

```javascript
smashcastWs.sendMessage('service.method', data);
```

### Events

#### Callback based

Register
```javascript
smashcastWs.on('service.method', callback);
```

Unregister
```javascript
smashcastWs.off('service.method', callback);
```


#### RxJs observable

Register
```javascript
const observable$ = smashcastWs.observe('service.method');
const subscription = observable$.subscribe(callback);
```
 
Unregister
```javascript
subscription.unsubscribe();
```

### Gotchas

#### Open callback will trigger immediately if smashcastWs is already connected!*
```javascript
smashcastWs.on('open', callback);
```

#### If you send a message when WS is not connected, the message will be sent when the connection is ready again
```javascript
smashcastWs.sendMessage('service.method', {});
```

#### If you don't set the service, chat will be used as default
```javascript
smashcastWs.sendMessage('method', {});
smashcastWs.on('method', callback);
```
