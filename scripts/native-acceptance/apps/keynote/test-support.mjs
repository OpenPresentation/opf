// NT-02 tests only: a raw probe -> probe lines serializer (the inverse of probe-lines.mjs, writing what keynote.applescript
// writes), small PNG files, and a fake `exec` that answers like this Mac and a Keynote with a scripted document. Nothing
// here runs a process.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const NOT_READ = new Set(['errors', 'skippedSlides', 'derived', 'input']);
const DERIVED = new Set(['isDefaultTitle', 'isDefaultBody', 'cellsByRow']);

export function escapeValue(text) {
  return String(text).replaceAll('\\', '\\\\').replaceAll('\t', '\\t').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function emit(pathText, value, out) {
  if (value === null || value === undefined) out.push(`${pathText}\tnull\t`);
  else if (typeof value === 'boolean') out.push(`${pathText}\tb\t${value}`);
  else if (typeof value === 'number') out.push(`${pathText}\tn\t${value}`);
  else if (typeof value === 'string') out.push(`${pathText}\ts\t${escapeValue(value)}`);
  else if (Array.isArray(value)) {
    out.push(`${pathText}\tlist\t${value.length}`);
    value.forEach((member, index) => {
      emit(`${pathText}/#${index}`, member, out);
    });
  } else {
    for (const [key, member] of Object.entries(value)) {
      if (DERIVED.has(key)) continue;
      // The script writes a slide's transition as a list of four (effect, duration, delay, automatic).
      if (key === 'transition' && /^slides\/#\d+$/u.test(pathText) && member && !Array.isArray(member)) {
        emit(`${pathText}/transition`, [member.effect, member.duration, member.delay, member.automatic], out);
      } else emit(pathText === '' ? key : `${pathText}/${key}`, member, out);
    }
  }
}

/** A raw probe object (as probe.json) -> the lines keynote.applescript would have written for it. */
export function probeToLines(probe) {
  const out = [];
  for (const [key, value] of Object.entries(probe)) if (!NOT_READ.has(key)) emit(key, value, out);
  return `${out.join('\n')}\n`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An ICC profile with only a v4 'desc' tag (mluc), enough for pngInfo to read the description. */
export function iccWithDescription(description) {
  const text = Buffer.from(description, 'utf16le').swap16();
  const tag = Buffer.alloc(28 + text.length);
  tag.write('mluc', 0, 'latin1');
  tag.writeUInt32BE(1, 8);
  tag.writeUInt32BE(12, 12);
  tag.write('enUS', 16, 'latin1');
  tag.writeUInt32BE(text.length, 20);
  tag.writeUInt32BE(28, 24);
  text.copy(tag, 28);
  const header = Buffer.alloc(144);
  header.writeUInt32BE(1, 128);
  header.write('desc', 132, 'latin1');
  header.writeUInt32BE(144, 136);
  header.writeUInt32BE(tag.length, 140);
  return Buffer.concat([header, tag]);
}

/** A PNG with a header, an optional embedded profile and an empty image: what pngInfo reads (no pixels needed). */
export function tinyPng({ width = 960, height = 540, colorType = 6, profile } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)];
  if (profile) parts.push(chunk('iCCP', Buffer.concat([Buffer.from('ICC Profile\0\0', 'latin1'), deflateSync(iccWithDescription(profile))])));
  parts.push(chunk('IDAT', deflateSync(Buffer.alloc(0))), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/**
 * A fake ctx.exec: this Mac (pgrep, ioreg, sw_vers, mdfind, plutil) and Keynote behind osascript, with documents (documentId: one id, or a list for
 * successive opens) of `slideCount` slides (`skipped` positions) whose probe lines are `lines`. `on.<verb>(args)` replaces one verb's answer.
 * exec.calls lists every [command, args, options].
 */
export function fakeExec({ running = true, locked = false, documents = [], slideCount = 4, skipped = [4], lines = '', on = {}, documentId = 'DOC-1' } = {}) {
  const open = [...documents];
  const ids = [documentId].flat();
  let opened = 0;
  const calls = [];
  const keynote = {
    info: () => ({ stdout: ['version\t16.0', ...open.map((document) => `document\t${document.id}\t${document.name}`)].join('\n') }),
    open: ([file]) => {
      const id = ids[Math.min(opened++, ids.length - 1)];
      open.push({ id, name: path.basename(file, '.pptx') });
      return { stdout: `OPENED\t${id}\t${slideCount}\t${skipped.join(',')}\n` };
    },
    probe: ([, file]) => {
      writeFileSync(file, lines);
      return { stdout: 'PROBED\n' };
    },
    render: ([, folder]) => {
      const exported = slideCount - skipped.length;
      for (let number = 1; number <= exported; number += 1) writeFileSync(path.join(folder, `_export.${String(number).padStart(3, '0')}.png`), tinyPng({ profile: 'Display P3' }));
      return { stdout: 'EXPORTED\n' };
    },
    resave: ([, file]) => {
      writeFileSync(file, 'PK');
      return { stdout: 'EXPORTED\n' };
    },
    close: ([id]) => {
      const at = open.findIndex((document) => document.id === id);
      if (at < 0) return { stdout: 'GONE\n' };
      open.splice(at, 1);
      return { stdout: 'CLOSED\n' };
    },
  };
  const plist = { CFBundleIdentifier: 'com.apple.Keynote', CFBundleVersion: '7052.0.68', CFBundleShortVersionString: '16.0' };
  const commands = {
    pgrep: () => ({ code: running ? 0 : 1 }),
    ioreg: () => ({ stdout: `<dict><key>CGSSessionScreenIsLocked</key><${locked}/><key>CGSSessionUserIDKey</key><integer>501</integer></dict>` }),
    sw_vers: () => ({ stdout: '26.6.2\n' }),
    mdfind: () => ({ stdout: '/Applications/Keynote.app\n' }),
    plutil: (args) => (plist[args[1]] ? { stdout: `${plist[args[1]]}\n` } : { code: 1 }),
    osascript: async ([, verb, ...rest]) => {
      const answer = on[verb] ? await on[verb](rest, keynote) : undefined;
      return answer ?? keynote[verb](rest);
    },
  };
  const exec = async (command, args = [], options = {}) => {
    calls.push([command, args, options]);
    const handler = commands[command];
    const answer = handler ? await handler(args) : { code: 127, stderr: `${command}: not faked` };
    return { code: 0, stdout: '', stderr: '', timedOut: false, seconds: 0.25, ...answer };
  };
  exec.calls = calls;
  exec.osascript = () => calls.filter(([command]) => command === 'osascript').map(([, args, options]) => [...args.slice(1), options.timeoutMs]);
  exec.openDocuments = open;
  return exec;
}
