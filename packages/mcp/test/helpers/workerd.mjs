// Runs the MCP Worker (test/helpers/mcp-worker.mjs) in the real `workerd` runtime, locally and with no Cloudflare account (the
// `workerd` npm package ships the binary), after bundling it the way Wrangler does: esbuild, platform neutral (so a Node builtin
// anywhere in the graph fails the bundle), and the `workerd`, `worker` and `browser` export conditions. Core's lane does the same for
// the validators (packages/javascript/test/support/workerd.mjs). Not a test.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(packageRoot, "package.json"));

/** The `workerd` binary and the newest compatibility date it supports, or undefined when the package has no binary for this platform. */
export function workerd() {
	try {
		const { default: binary, compatibilityDate } = require("workerd");
		return { binary, compatibilityDate };
	} catch {
		return undefined;
	}
}

const esbuild = () => createRequire(require.resolve("tsup"))("esbuild");

/** The bundled Worker (`entry` is a file of test/helpers/): { text, bytes }. Throws when any module of the graph needs a Node builtin. */
export async function bundleWorker(entry = "mcp-worker.mjs") {
	const result = await esbuild().build({
		entryPoints: [path.join(packageRoot, "test", "helpers", entry)],
		absWorkingDir: packageRoot,
		bundle: true,
		format: "esm",
		platform: "neutral",
		target: "es2022",
		mainFields: ["browser", "module", "main"],
		conditions: ["workerd", "worker", "browser"],
		write: false,
		logLevel: "silent",
	});
	const text = result.outputFiles[0].text;
	return { text, bytes: result.outputFiles[0].contents.length };
}

const freePort = () =>
	new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});

/** Starts workerd with the bundle as the only Worker, listening on a free local port. */
export async function startWorker(source) {
	const runtime = workerd();
	if (!runtime) throw new Error("The workerd package has no binary for this platform.");
	const directory = mkdtempSync(path.join(tmpdir(), "opf-mcp-workerd-"));
	const port = await freePort();
	writeFileSync(path.join(directory, "worker.mjs"), source);
	writeFileSync(
		path.join(directory, "config.capnp"),
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
	const child = spawn(runtime.binary, ["serve", path.join(directory, "config.capnp")], { stdio: ["ignore", "pipe", "pipe"] });
	let log = "";
	for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => (log += chunk));
	let exited = false;
	child.once("exit", () => (exited = true));
	const url = `http://127.0.0.1:${port}/`;
	const stop = async () => {
		if (!exited) {
			child.kill("SIGKILL");
			await new Promise((resolve) => (exited ? resolve() : child.once("exit", resolve)));
		}
		rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
	};
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
