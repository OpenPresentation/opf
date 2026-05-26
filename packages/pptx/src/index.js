export const packageName = "@openpresentation/opf-pptx";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-pptx",
  npmPackage: "@openpresentation/opf-pptx",
  compatibilityPackage: "@openpresentation/opf",
  rendererPackage: "@openpresentation/opf-render"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredAiDependency: false,
  requiredLibreOfficeDependency: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});
