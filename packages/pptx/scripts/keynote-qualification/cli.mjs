#!/usr/bin/env node
import assert from 'node:assert/strict';
import {sealRegistryRuntime} from './registry-runtime.mjs';
import {generate, verifySeal, prepareCopy, inspectNative, sealCandidate, prepareFooterControls, verifyFooterControls, prepareFooterCopy} from './pack.mjs';
const [command, ...args] = process.argv.slice(2), options = {};
assert.equal(args.length % 2, 0, 'Expected --name value pairs');
for (let index = 0; index < args.length; index += 2) {
  assert.match(args[index], /^--(?:consumer|output|suite|route|input|mode|candidate|source|revision|tarball|variant|registry|registry-sha256|verifier-source|verifier-revision|publisher)$/);
  const name = args[index].slice(2); assert.ok(!Object.hasOwn(options, name), `Duplicate --${name}`); options[name] = args[index + 1];
}
const required = {registry: ['consumer', 'verifier-source', 'verifier-revision', 'publisher', 'output'], generate: ['consumer', 'output'], verify: ['suite'], copy: ['suite', 'route', 'output'], inspect: ['suite', 'consumer', 'input', 'route', 'output'], candidate: ['source', 'revision', 'tarball', 'consumer', 'output'], 'footer-controls': ['suite', 'consumer', 'output'], 'footer-verify': ['suite'], 'footer-copy': ['suite', 'variant', 'output']};
assert.ok(Object.hasOwn(required, command), 'Commands: registry, candidate, generate, verify, copy, inspect, footer-controls, footer-verify, footer-copy (docs/keynote-qualification.md)');
const optional = command === 'generate' ? ['mode', 'candidate', 'registry', 'registry-sha256'] : [];
assert.ok(required[command].every(key => Object.hasOwn(options, key)) && Object.keys(options).every(key => required[command].includes(key) || optional.includes(key)), 'Missing or unexpected options');
if (command === 'registry') {const sealed = await sealRegistryRuntime(options); console.log(`Sealed four registry artifact identities: ${sealed.sha256}; independent acceptance and native checks remain separate. ${options.output}`);}
if (command === 'candidate') {const receipt = await sealCandidate(options); console.log(`Sealed local candidate ${receipt.source.revision}; no registry claim. ${options.output}`);}
if (command === 'generate') {const suite = await generate(options); console.log(`Prepared ${suite.kind}: ${suite.fixture ?? 'baseline-16'} / ${suite.mode ?? 'baseline'}; native acceptance pending. ${options.output}`);}
if (command === 'verify') {const {suite} = await verifySeal(options.suite); console.log(`Verified ${suite.files.length} sealed files; no native acceptance claim.`);}
if (command === 'copy') console.log(`Fresh editable attempt: ${await prepareCopy(options)}`);
if (command === 'footer-controls') {const suite = await prepareFooterControls(options); console.log(`Prepared ${suite.kind}: A exact input; B sixteen ftr token removals only. Native acceptance pending. ${options.output}`);}
if (command === 'footer-verify') {const {suite} = await verifyFooterControls(options.suite); console.log(`Verified ${suite.files.length} sealed footer-control files; no native acceptance claim.`);}
if (command === 'footer-copy') console.log(`Fresh footer attempt: ${await prepareFooterCopy(options)}`);
if (command === 'inspect') {const report = await inspectNative(options); console.log(`Static native-export inspection: ${report.failures.length} findings. ${options.output}`); if (report.failures.length) process.exitCode = 1;}
