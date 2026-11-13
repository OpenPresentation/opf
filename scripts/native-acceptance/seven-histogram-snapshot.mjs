// Closed classic histogram entry; the ordinary treemap entry stays strict.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {histogramSnapshotRoute} from './seven-value-snapshot-profile.mjs';
export const {createSnapshotEnvelope,validateSnapshotEnvelope,readSnapshotEnvelope,expectedSnapshotRequest,assertSnapshotOutput,verifySnapshotExecution,prepareSnapshotExecution,snapshotBeforeOperations,assertSnapshotBeforeReady,snapshotOperations,snapshotCriticalProbes,assertSnapshotReady,verifyNativeBefore,snapshotAdmission}=histogramSnapshotRoute;
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)histogramSnapshotRoute.main(process.argv.slice(2)).catch(error=>{console.error(error.stack);process.exitCode=1;});
