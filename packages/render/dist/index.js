export const packageName = "@openpresentation/opf-render";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-render",
  npmPackage: "@openpresentation/opf-render",
  compatibilityPackage: "@openpresentation/opf"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});
