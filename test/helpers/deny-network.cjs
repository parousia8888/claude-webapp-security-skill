const deny = () => { throw new Error('network access denied by project discovery test'); };

for (const moduleName of ['node:http', 'node:https']) {
  const module = require(moduleName);
  module.get = deny;
  module.request = deny;
}
const net = require('node:net');
net.connect = deny;
net.createConnection = deny;
const dns = require('node:dns');
dns.lookup = deny;
dns.resolve = deny;
dns.promises.lookup = deny;
dns.promises.resolve = deny;
globalThis.fetch = deny;
