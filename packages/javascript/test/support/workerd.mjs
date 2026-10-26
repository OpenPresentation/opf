// CE-01: runs a bundled Worker in the real `workerd` runtime (the one Cloudflare Workers run on), locally and with no Cloudflare
// account: the `workerd` npm package ships the binary. Not a test.
//
//   const worker = await startWorker({ conditions: ['workerd', 'worker', 'browser'] });
//   const answer = await (await fetch(worker.url, { method: 'POST', body: '[]' })).json();
//   await worker.stop();
//
// `bundleWorker` bundles test/support/edge-worker.mjs the way Wrangler does (esbuild, platform neutral, the `workerd`, `worker`
// and `browser` conditions, `@openpresentation/opf` resolved from an application folder that links the built package), so which
// build of the package the Worker runs is decided by the package's export conditions and nothing else.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(packageRoot, 'package.json'));

/** The `workerd` binary and the newest compatibility date it supports, or undefined when the package has no binary for this platform. */
export function workerd() {
	try {
		const { default: binary, compatibilityDate } = require('workerd');
		return { binary, compatibilityDate };
	} catch {
		return undefined;
	}
}

/** esbuild, from the copy tsup (a devDependency of the package) brings. */
const esbuild = () => createRequire(require.resolve('tsup'))('esbuild');

/** Bundles the test Worker with the given export conditions; returns the module source. */
export async function bundleWorker({ conditions = ['workerd', 'worker', 'browser'] } = {}) {
	const app = mkdtempSync(path.join(tmpdir(), 'opf-workerd-app-'));
	try {
		mkdirSync(path.join(app, 'node_modules', '@openpresentation'), { recursive: true });
		symlinkSync(packageRoot, path.join(app, 'node_modules', '@openpresentation', 'opf'), 'junction');
		const result = await esbuild().build({
			entryPoints: [path.join(packageRoot, 'test', 'support', 'edge-worker.mjs')],
			absWorkingDir: app,
			nodePaths: [path.join(app, 'node_modules')],
			bundle: true,
			format: 'esm',
			platform: 'neutral',
			target: 'es2022',
			mainFields: ['browser', 'module', 'main'],
			conditions,
			write: false,
			logLevel: 'silent',
		});
		return result.outputFiles[0].text;
	} finally {
		rmSync(app, { recursive: true, force: true });
	}
}

const freePort = () =>
	new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});

/** Starts workerd with the bundle as the only Worker, listening on a free local port. */
export async function startWorker({ conditions } = {}) {
	const runtime = workerd();
	if (!runtime) throw new Error('The workerd package has no binary for this platform.');
	const directory = mkdtempSync(path.join(tmpdir(), 'opf-workerd-'));
	const port = await freePort();
	writeFileSync(path.join(directory, 'worker.mjs'), await bundleWorker({ conditions }));
	writeFileSync(
		path.join(directory, 'config.capnp'),
		`using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [(name = "main", worker = .worker)],
  sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")]
);
const worker :Workerd.Worker = (
  modules = [(name = "worker", esModule = embed "worker.mjs")],
  compatibilityDate = "${runtime.compatibilityDate}",
);
`,
	);
	const child = spawn(runtime.binary, ['serve', path.join(directory, 'config.capnp')], { stdio: ['ignore', 'pipe', 'pipe'] });
	let log = '';
	for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => (log += chunk));
	let exited = false;
	child.once('exit', () => (exited = true));
	const url = `http://127.0.0.1:${port}/`;
	const stop = async () => {
		if (!exited) {
			child.kill('SIGKILL');
			await new Promise((resolve) => (exited ? resolve() : child.once('exit', resolve)));
		}
		// Windows keeps the files of a process that was just killed for a moment.
		rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
	};
	// Ready when it answers a GET.
	const deadline = Date.now() + 30_000;
	for (;;) {
		if (exited) throw new Error(`workerd exited before it answered:\n${log.slice(-2000)}`);
		try {
			if ((await fetch(url)).ok) break;
		} catch {
			// not listening yet
		}
		if (Date.now() > deadline) {
			await stop();
			throw new Error(`workerd did not answer within 30 s:\n${log.slice(-2000)}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	return { url, stop, log: () => log };
}
