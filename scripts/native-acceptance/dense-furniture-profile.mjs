// Dedicated exact-50 FULL59 entry. Ordinary furniture caps and old dense driver stay separate.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {denseFurnitureRoute} from './furniture-profile.mjs';
export {DENSE_FURNITURE_PROFILE,DENSE_FURNITURE_POLICY} from './furniture-profile.mjs';
export const {bindFurnitureEnvelope,createFurnitureEnvelope,prepareFurnitureExecution,verifyFurnitureExecution,assertFurnitureReady,admitFurnitureExecution,assertFurnitureSelection}=denseFurnitureRoute;
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)denseFurnitureRoute.main(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
