// node --import ./patched/register.mjs <script>: activates the scratch policy patch for that process only.
import {register} from 'node:module';
register('./hooks.mjs', import.meta.url);
process.env.OPF361_PATCHED_POLICY = '1';
