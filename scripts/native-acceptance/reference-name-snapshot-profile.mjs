// Distinct prospective three-archive Name route, never the failed old profile.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {referenceNameSnapshotFurnitureRoute} from './furniture-profile.mjs';
export const {createFurnitureEnvelope,bindFurnitureEnvelope,prepareFurnitureExecution,verifyFurnitureExecution,assertFurnitureReady,admitFurnitureExecution}=referenceNameSnapshotFurnitureRoute;
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)referenceNameSnapshotFurnitureRoute.main(process.argv.slice(2)).catch(error=>{console.error(error.stack);process.exitCode=1;});
