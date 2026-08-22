import { describe, expect, it } from "bun:test";
import { bucket, formatReport, isTestFile, summarizeViolations } from "./boundary-report.mjs";

const featureEdge = {
  from: "src/features/admissions/lib/create-admission.ts",
  to: "src/features/customers/lib/staff-document-upload.ts",
  rule: { name: "features-not-to-features" },
};

const testEdge = {
  from: "src/features/admissions/lib/create-admission.test.ts",
  to: "src/features/customers/lib/staff-document-upload.ts",
  rule: { name: "features-not-to-features" },
};

const proxyEdge = {
  from: "src/proxy.ts",
  to: "src/features/onboarding/lib/routing.ts",
  rule: { name: "only-app-imports-features" },
};

describe("isTestFile", () => {
  it("matches colocated unit and integration names", () => {
    expect(isTestFile("src/features/admissions/enroll.test.ts")).toBe(true);
    expect(isTestFile("src/features/admissions/enroll.integration.test.ts")).toBe(true);
    expect(isTestFile("e2e/web/auth.spec.ts")).toBe(true);
    expect(isTestFile("src/features/admissions/enroll.ts")).toBe(false);
  });
});

describe("bucket", () => {
  it("names features, app, proxy, and shared", () => {
    expect(bucket("src/features/admissions/lib/foo.ts")).toBe("features/admissions");
    expect(bucket("src/app/dashboard/page.tsx")).toBe("app");
    expect(bucket("src/proxy.ts")).toBe("src/proxy.ts");
    expect(bucket("src/shared/money.ts")).toBe("shared");
  });
});

describe("summarizeViolations", () => {
  it("drops test files unless strict", () => {
    const loose = summarizeViolations([featureEdge, testEdge]);
    expect(loose.files).toEqual([featureEdge.from]);
    expect(loose.pairs).toHaveLength(1);

    const strict = summarizeViolations([featureEdge, testEdge], { strict: true });
    expect(strict.files).toEqual([testEdge.from, featureEdge.from]);
    expect(strict.pairs[0]?.files).toHaveLength(2);
  });

  it("groups many files into one pair", () => {
    const extra = {
      ...featureEdge,
      from: "src/features/admissions/server/enroll.ts",
    };
    const summary = summarizeViolations([featureEdge, extra]);
    expect(summary.pairs).toEqual([
      {
        key: "features/admissions → features/customers",
        from: "features/admissions",
        to: "features/customers",
        rule: "features-not-to-features",
        files: [featureEdge.from, extra.from],
      },
    ]);
  });
});

describe("formatReport", () => {
  it("prints pairs instead of a raw edge dump", () => {
    const report = formatReport(summarizeViolations([featureEdge, testEdge]));
    expect(report).toContain("features/admissions → features/customers  (1 file)");
    expect(report).toContain(featureEdge.from);
    expect(report).not.toContain(testEdge.from);
    expect(report).toContain("Hoist the shared type");
  });

  it("labels proxy as its own composition root", () => {
    const report = formatReport(summarizeViolations([proxyEdge]));
    expect(report).toContain("src/proxy.ts → features/onboarding");
  });
});
