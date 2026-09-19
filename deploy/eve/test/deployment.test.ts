import { expect, test } from "bun:test";
import { deploymentReceipt, verifyDeployment } from "../agent/lib/deployment.js";
import type { github } from "../agent/lib/github.js";
import type { Batch } from "../agent/lib/store.js";

const candidate = "b".repeat(40);
const batch = {
  candidate,
  coverage: {
    deployed: {
      environment: "staging",
      origin: "https://staging.example.com",
      creator: "vercel[bot]",
    },
  },
} as Batch;
const receipt = { deploymentId: 10, statusId: 20 };
const deployment = () => ({
  id: 10,
  sha: candidate,
  environment: "staging",
  production_environment: false,
  creator: { login: "vercel[bot]" },
});
const status = () => ({
  id: 20,
  state: "success",
  environment: "staging",
  environment_url: "https://staging.example.com",
  creator: { login: "vercel[bot]" },
});
function api(d = deployment(), s = status()) {
  return (async (path: string) =>
    path.startsWith("/deployments?")
      ? [{ id: 10 }]
      : path.endsWith("per_page=1")
        ? [s]
        : d) as typeof github;
}
test("uses authenticated GitHub deployment metadata, not operator URL/SHA claims", async () => {
  expect(await verifyDeployment(batch, receipt, api())).toEqual({
    ...receipt,
    commit: candidate,
    url: "https://staging.example.com/",
  });
  expect(() =>
    deploymentReceipt(
      '```factory-deployment\n{"deploymentId":10,"statusId":20,"url":"https://evil.example"}\n```',
    ),
  ).toThrow();
});
for (const defect of [
  "commit",
  "production",
  "environment",
  "creator",
  "inactive",
  "new-status",
  "status-creator",
  "url",
  "credential-url",
]) {
  test(`rejects deployment ${defect}`, async () => {
    const d = deployment(),
      s = status();
    if (defect === "commit") d.sha = "c".repeat(40);
    if (defect === "production") d.production_environment = true;
    if (defect === "environment") d.environment = "preview";
    if (defect === "creator") d.creator.login = "untrusted";
    if (defect === "inactive") s.state = "inactive";
    if (defect === "new-status") s.id++;
    if (defect === "status-creator") s.creator.login = "untrusted";
    if (defect === "url") s.environment_url = "https://other.example";
    if (defect === "credential-url") s.environment_url = "https://secret@staging.example.com";
    await expect(verifyDeployment(batch, receipt, api(d, s))).rejects.toThrow();
  });
}
test("an older still-successful deployment is not current staging", async () => {
  const request = (async (path: string) =>
    path.startsWith("/deployments?") ? [{ id: 11 }] : deployment()) as typeof github;
  await expect(verifyDeployment(batch, receipt, request)).rejects.toThrow("superseded");
});
