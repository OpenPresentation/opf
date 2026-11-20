// Separate literal-result entry. The linked histogram entry remains strict.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {histogramLiteralSnapshotRoute} from './seven-value-snapshot-profile.mjs';
export const {createSnapshotEnvelope,validateSnapshotEnvelope,readSnapshotEnvelope,expectedSnapshotRequest,assertSnapshotOutput,verifySnapshotExecution,prepareSnapshotExecution,snapshotBeforeOperations,assertSnapshotBeforeReady,snapshotOperations,snapshotCriticalProbes,assertSnapshotReady,verifyNativeBefore,snapshotAdmission}=histogramLiteralSnapshotRoute;
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)histogramLiteralSnapshotRoute.main(process.argv.slice(2)).catch(error=>{console.error(error.stack);process.exitCode=1;});
