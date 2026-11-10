// One approved source-only append; no Office, product files or public API changes.
await import('./offset-capability.mjs');
if(process.exitCode)throw Error('Full-line source trace refused; no variant constructor');
await import('./offset-variants.mjs');
