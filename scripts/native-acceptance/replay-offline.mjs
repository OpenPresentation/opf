// Same socket/fetch refusal policy as packages/cli/test/installed-regression.mjs.
// Used before installed engines load and preloaded into the installed CLI child.
import net from 'node:net';
import {appendFileSync} from 'node:fs';

export function installOfflineGuard(log) {
  const connect = net.Socket.prototype.connect;
  const fetch = globalThis.fetch;
  const refuse = kind => {
    appendFileSync(log, JSON.stringify({kind}) + '\n');
    throw new Error(`Retained-save replay refuses network access: ${kind}`);
  };
  net.Socket.prototype.connect = function () { return refuse('connect'); };
  globalThis.fetch = async () => refuse('fetch');
  return () => { net.Socket.prototype.connect = connect; globalThis.fetch = fetch; };
}

if (process.env.OPF_REPLAY_NETWORK_LOG) installOfflineGuard(process.env.OPF_REPLAY_NETWORK_LOG);
