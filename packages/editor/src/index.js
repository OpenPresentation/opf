export const packageName = "@openpresentation/opf-editor";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-editor",
  npmPackage: "@openpresentation/opf-editor",
  compatibilityPackage: "@openpresentation/opf",
  rendererPackage: "@openpresentation/opf-render"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});
