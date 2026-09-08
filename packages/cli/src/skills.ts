import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import {
	lstat,
	mkdir,
	open,
	readFile,
	readdir,
	realpath,
	rename,
	rmdir,
	unlink,
	writeFile,
} from "node:fs/promises";
import path from "node:path";

export type SkillBundle = Record<string, Record<string, string>>;
type Managed = { format: 1; version: string; files: Record<string, string> };
export class SkillsError extends Error {
	constructor(
		message: string,
		readonly code = 1,
	) {
		super(message);
	}
}
const marker = ".opf-managed.json";
const digest = (value: string | Uint8Array) =>
	createHash("sha256").update(value).digest("hex");
const same = (a: Record<string, string>, b: Record<string, string>) =>
	JSON.stringify(Object.entries(a).sort()) ===
	JSON.stringify(Object.entries(b).sort());
const safe = (value: string) =>
	value.length > 0 &&
	!path.isAbsolute(value) &&
	!value.includes("\\") &&
	value
		.split("/")
		.every((part) => part !== "" && part !== "." && part !== "..");
async function stat(file: string) {
	try {
		return await lstat(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}
async function noLinks(directory: string) {
	let current = path.parse(directory).root;
	for (const part of directory
		.slice(current.length)
		.split(path.sep)
		.filter(Boolean)) {
		current = path.join(current, part);
		const item = await stat(current);
		if (item?.isSymbolicLink() || (item && !item.isDirectory()))
			throw new SkillsError(
				`Skill destination contains a symlink or non-directory: ${current}`,
			);
	}
}
async function resolvedDestination(requested: string) {
	const leaf = await stat(requested);
	if (leaf?.isSymbolicLink() || (leaf && !leaf.isDirectory())) {
		throw new SkillsError(`Refusing a symlink or non-directory skill destination: ${requested}`);
	}
	// Resolve existing ancestors once, including linked project directories and
	// macOS /var or /tmp. All later inspection and writes use the canonical path.
	let ancestor = requested;
	const missing: string[] = [];
	while (!(await stat(ancestor))) {
		missing.unshift(path.basename(ancestor));
		const parent = path.dirname(ancestor);
		if (parent === ancestor) throw new SkillsError(`Cannot resolve skill destination: ${requested}`);
		ancestor = parent;
	}
	return path.join(await realpath(ancestor), ...missing);
}
async function hashes(
	directory: string,
	prefix = "",
): Promise<Record<string, string>> {
	const result: Record<string, string> = Object.create(null);
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (!prefix && entry.name === marker) continue;
		const relative = prefix + entry.name,
			full = path.join(directory, entry.name);
		if (entry.isSymbolicLink())
			throw new SkillsError(
				`Refusing to follow installed skill symlink: ${full}`,
			);
		if (entry.isDirectory())
			Object.assign(result, await hashes(full, relative + "/"));
		else if (entry.isFile()) result[relative] = digest(await readFile(full));
		else throw new SkillsError(`Unexpected installed skill entry: ${full}`);
	}
	return result;
}
async function inspect(
	directory: string,
): Promise<{
	status: "missing" | "unmanaged" | "managed" | "modified";
	state?: Managed;
}> {
	const item = await stat(directory);
	if (!item) return { status: "missing" as const };
	if (!item.isDirectory() || item.isSymbolicLink())
		throw new SkillsError(
			`Refusing to replace a symlink or non-directory: ${directory}`,
		);
	const record = path.join(directory, marker),
		recordStat = await stat(record);
	if (!recordStat?.isFile() || recordStat.isSymbolicLink())
		return { status: "unmanaged" as const };
	let state: Managed;
	try {
		state = JSON.parse(await readFile(record, "utf8"));
	} catch {
		return { status: "unmanaged" as const };
	}
	if (
		!state ||
		typeof state !== "object" ||
		state.format !== 1 ||
		typeof state.version !== "string" ||
		!state.files ||
		typeof state.files !== "object" ||
		Array.isArray(state.files) ||
		!Object.entries(state.files).every(
			([file, hash]) =>
				safe(file) && typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash),
		)
	)
		return { status: "unmanaged" as const };
	return {
		status: same(await hashes(directory), state.files)
			? ("managed" as const)
			: ("modified" as const),
		state,
	};
}
export function skillDestination(
	options: { agent?: string; global?: boolean; directory?: string },
	cwd = process.cwd(),
	home = homedir(),
) {
	if (options.directory) {
		if (options.agent || options.global)
			throw new SkillsError(
				"--directory cannot be combined with --agent or --global",
				2,
			);
		return path.resolve(cwd, options.directory);
	}
	const agent = options.agent ?? "universal";
	const locations: Record<string, [string, string]> = {
		universal: [".agents/skills", ".agents/skills"],
		codex: [".agents/skills", ".codex/skills"],
		"claude-code": [".claude/skills", ".claude/skills"],
		cursor: [".cursor/skills", ".cursor/skills"],
	};
	const selected = Object.hasOwn(locations, agent)
		? locations[agent]
		: undefined;
	if (!selected)
		throw new SkillsError(
			"Supported agents: universal, codex, claude-code, cursor. Use --directory for another agent.",
			2,
		);
	return path.resolve(
		options.global ? home : cwd,
		selected[options.global ? 1 : 0],
	);
}
export async function manageSkills(
	action: string,
	bundle: SkillBundle,
	version: string,
	options: { agent?: string; global?: boolean; directory?: string },
) {
	if (!["install", "update", "status"].includes(action))
		throw new SkillsError("Use opf skills install, update, or status.", 2);
	const root = await resolvedDestination(skillDestination(options));
	await noLinks(root);
	const names = Object.keys(bundle).sort();
	for (const name of names) {
		if (!/^opf-[a-z]+$/.test(name) || !bundle[name]["SKILL.md"])
			throw new Error("Invalid bundled skill name or entrypoint");
		for (const file of Object.keys(bundle[name]))
			if (!safe(file) || file === marker)
				throw new Error("Invalid bundled skill path");
	}
	const states = await Promise.all(
		names.map(async (name) => ({
			name,
			...(await inspect(path.join(root, name))),
		})),
	);
	if (action === "status")
		return {
			version,
			directory: root,
			skills: states.map(({ name, status, state }) => ({
				name,
				status,
				installedVersion: state?.version,
				updateAvailable: state ? state.version !== version : undefined,
			})),
		};
	const conflicts = states.filter(
		(item) => item.status === "modified" || item.status === "unmanaged",
	);
	if (conflicts.length)
		throw new SkillsError(
			`No skills changed. Preserve or move these locally modified/unmanaged folders before retrying: ${conflicts.map((item) => path.join(root, item.name)).join(", ")}`,
		);
	const changed = states.filter(
		(item) =>
			!item.state ||
			!same(
				item.state.files,
				Object.fromEntries(
					Object.entries(bundle[item.name]).map(([file, text]) => [
						file,
						digest(text),
					]),
				),
			) ||
			item.state.version !== version,
	);
	if (!changed.length)
		return { version, directory: root, changed: [], unchanged: names };
	await mkdir(root, { recursive: true });
	await noLinks(root);
	const lockPath = path.join(root, ".opf-install.lock");
	const lock = await open(lockPath, "wx").catch((error) => {
		if ((error as NodeJS.ErrnoException).code === "EEXIST")
			throw new SkillsError(
				`Another skill installation owns ${lockPath}. If it stopped unexpectedly, inspect its recovery files before removing the stale lock.`,
			);
		throw error;
	});
	try {
		// Keep backups outside the agent's skills directory so old skills cannot be
		// discovered as additional active instructions.
		const transaction = path.join(
			path.dirname(root),
			`.opf-skills-${randomUUID()}`,
		);
		await mkdir(transaction);
		const applied: Array<{ name: string; backup?: string }> = [];
		try {
			// Prepare all six folders before changing any installed skill.
			for (const item of changed) {
				const staged = path.join(transaction, item.name),
					files = bundle[item.name];
				await mkdir(staged);
				for (const [file, text] of Object.entries(files)) {
					const destination = path.join(staged, file);
					await mkdir(path.dirname(destination), { recursive: true });
					await writeFile(destination, text, { flag: "wx" });
				}
				await writeFile(
					path.join(staged, marker),
					JSON.stringify(
						{
							format: 1,
							version,
							files: Object.fromEntries(
								Object.entries(files).map(([file, text]) => [
									file,
									digest(text),
								]),
							),
						} satisfies Managed,
						null,
						2,
					) + "\n",
					{ flag: "wx" },
				);
			}
			// Check again after staging, before swapping the installed directories.
			for (const item of changed) {
				const latest = await inspect(path.join(root, item.name));
				if (
					latest.status !== item.status ||
					JSON.stringify(latest.state) !== JSON.stringify(item.state)
				)
					throw new SkillsError(
						"Installed skills changed during preparation; retry from the new state.",
					);
			}
			for (const item of changed) {
				const destination = path.join(root, item.name),
					backup = item.state
						? path.join(transaction, item.name + ".previous")
						: undefined;
				if (backup) await rename(destination, backup);
				try {
					await rename(path.join(transaction, item.name), destination);
				} catch (error) {
					if (backup) await rename(backup, destination);
					throw error;
				}
				applied.push({ name: item.name, backup });
			}
		} catch (error) {
			// Keep recovery files if rollback itself fails; never delete user originals.
			for (const item of applied.reverse()) {
				await rename(
					path.join(root, item.name),
					path.join(transaction, item.name + ".rolled-back"),
				);
				if (item.backup) await rename(item.backup, path.join(root, item.name));
			}
			throw error;
		}
		const backups = applied
			.filter((item) => item.backup)
			.map((item) => item.backup);
		// Only remove our empty, uniquely named transaction folder. Prior versions
		// remain recoverable when an update replaces managed files.
		if (!backups.length) await rmdir(transaction);
		return {
			version,
			directory: root,
			changed: changed.map((item) => item.name),
			unchanged: names.filter(
				(name) => !changed.some((item) => item.name === name),
			),
			backups,
		};
	} finally {
		await lock.close();
		await unlink(lockPath);
	}
}
