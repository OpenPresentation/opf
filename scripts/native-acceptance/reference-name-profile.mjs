// Closed route entry. Source/actions and policy are internal constants, not CLI overrides.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {referenceNameFurnitureRoute} from './furniture-profile.mjs';
export const {createFurnitureEnvelope:createReferenceNameEnvelope,bindFurnitureEnvelope:bindReferenceNameEnvelope,prepareFurnitureExecution:prepareReferenceNameExecution,verifyFurnitureExecution:verifyReferenceNameExecution}=referenceNameFurnitureRoute;
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)referenceNameFurnitureRoute.main(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
