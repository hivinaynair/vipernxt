/** @type {import("dependency-cruiser").IConfiguration} */
export default {
  forbidden: [
    {
      name: "features-not-to-features",
      comment: "Features cannot import each other. Hoist shared code to src/shared or packages/.",
      severity: "error",
      from: { path: "(^src/features/)([^/]+)/" },
      to: { path: "^$1", pathNot: "$1$2" },
    },
    {
      name: "shared-not-to-features",
      comment: "shared/ has no knowledge of features.",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/features/" },
    },
    {
      name: "features-not-to-app",
      comment: "Features must not import the App Router tree. app/ composes features.",
      severity: "error",
      from: { path: "^src/features/" },
      to: { path: "^src/app/" },
    },
    {
      name: "only-app-imports-features",
      comment:
        "Only composition roots may import features: src/app and src/proxy.ts. Features may import themselves. src/lib and src/components still belong in shared/ or a feature.",
      severity: "error",
      from: { pathNot: ["^src/app/", "^src/features/", "^src/proxy\\.ts$"] },
      to: { path: "^src/features/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules|(^\\.\\./)" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    },
  },
};
