const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');

const allowed = new Set(['127.0.0.1', '::1', 'localhost']);
const hostFromArgs = (args) => {
  if (typeof args[0] === 'object' && args[0] !== null) return args[0].host || args[0].hostname || 'localhost';
  if (typeof args[1] === 'string') return args[1];
  if (typeof args[2] === 'string') return args[2];
  return 'localhost';
};

for (const name of ['connect', 'createConnection']) {
  const original = net[name];
  net[name] = function localOnly(...args) {
    const host = hostFromArgs(args);
    if (!allowed.has(String(host).replace(/^\[|\]$/g, ''))) {
      throw new Error(`external network denied: ${host}`);
    }
    return original.apply(this, args);
  };
}

const originalTlsConnect = tls.connect;
tls.connect = function localTlsOnly(...args) {
  const host = hostFromArgs(args);
  if (!allowed.has(String(host).replace(/^\[|\]$/g, ''))) {
    throw new Error(`external TLS denied: ${host}`);
  }
  return originalTlsConnect.apply(this, args);
};

const noPtr = Object.assign(new Error('local fixture has no PTR'), { code: 'ENOTFOUND' });
dns.reverse = (_ip, callback) => process.nextTick(callback, noPtr);
dns.promises.reverse = async () => { throw noPtr; };
