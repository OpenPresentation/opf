// A minimal ZIP writer for per-slide SVG and PNG archives. Entries are stored, not deflated, and carry a fixed
// timestamp, so the archive bytes depend only on the file names and contents (zlib's deflate output can differ between
// builds, which would make the archive hash host-dependent).
import { crc32 } from "node:zlib";

const DOS_TIME = 0; // 00:00:00
const DOS_DATE = ((1980 - 1980) << 9) | (1 << 5) | 1; // 1980-01-01

export function createZip(entries: { name: string; bytes: Uint8Array }[]): Uint8Array {
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
		const name = encoder.encode(entry.name);
		const crc = crc32(entry.bytes);
		if (entry.bytes.length > 0xfffffffe || offset > 0xfffffffe || entries.length > 0xfffe) throw new RangeError("The archive is too large for a plain ZIP file.");
		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true);
		local.setUint16(4, 20, true); // version needed
		local.setUint16(6, 0x0800, true); // UTF-8 names
		local.setUint16(8, 0, true); // stored
		local.setUint16(10, DOS_TIME, true);
		local.setUint16(12, DOS_DATE, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, entry.bytes.length, true);
		local.setUint32(22, entry.bytes.length, true);
		local.setUint16(26, name.length, true);
		local.setUint16(28, 0, true);
		const header = new DataView(new ArrayBuffer(46));
		header.setUint32(0, 0x02014b50, true);
		header.setUint16(4, 20, true);
		header.setUint16(6, 20, true);
		header.setUint16(8, 0x0800, true);
		header.setUint16(10, 0, true);
		header.setUint16(12, DOS_TIME, true);
		header.setUint16(14, DOS_DATE, true);
		header.setUint32(16, crc, true);
		header.setUint32(20, entry.bytes.length, true);
		header.setUint32(24, entry.bytes.length, true);
		header.setUint16(28, name.length, true);
		header.setUint32(42, offset, true);
		chunks.push(new Uint8Array(local.buffer), name, entry.bytes);
		central.push(new Uint8Array(header.buffer), name);
		offset += 30 + name.length + entry.bytes.length;
	}
	const size = central.reduce((total, chunk) => total + chunk.length, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(8, entries.length, true);
	end.setUint16(10, entries.length, true);
	end.setUint32(12, size, true);
	end.setUint32(16, offset, true);
	return Buffer.concat([...chunks, ...central, new Uint8Array(end.buffer)]);
}
