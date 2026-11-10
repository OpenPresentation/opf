// Real controller identity boundary only; no package consumer, profile or Office.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {assertB07ControllerDirectory} from './b07-current-profile.mjs';
import {repositoryIdentity} from './identity.mjs';

test('B07 binds its canonical controller and refuses envelope aliases or another checkout',()=>{
  const rootUrl=new URL('../../',import.meta.url), root=fs.realpathSync(fileURLToPath(rootUrl));
  const identity=repositoryIdentity(root,['scripts/native-acceptance/b07-current-profile.mjs']);
  assert.equal(identity.directory,root);
  assertB07ControllerDirectory(identity.directory);
  assert.throws(()=>assertB07ControllerDirectory(root+path.sep),/Wrong canonical B07 controller directory/);
  assert.throws(()=>assertB07ControllerDirectory(path.join(root,'..',path.basename(root)+'-other')),/Wrong canonical B07 controller directory/);
  assert.throws(()=>assertB07ControllerDirectory(path.join(root,'scripts')),/Wrong canonical B07 controller directory/);
});
