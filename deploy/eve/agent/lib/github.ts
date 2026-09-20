import { repository } from "./config.js";
import { githubToken } from "./credentials.js";

export class GitHubError extends Error {
  constructor(
    public status: number,
    detail = "",
  ) {
    super(detail ? `GitHub HTTP ${status} ${detail}` : `GitHub HTTP ${status}`);
  }
}
export async function github<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${repository()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await githubToken()}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new GitHubError(response.status, `${method} ${path}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export type Issue = {
  number: number;
  body: string | null;
  state: string;
  labels: { name: string }[];
  pull_request?: unknown;
};
export async function file(path: string, ref: string) {
  try {
    const result = await github<{ content: string; encoding: string; sha: string }>(
      `/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    if (result.encoding !== "base64") throw new Error("Expected a small pinned text artifact");
    return { text: Buffer.from(result.content, "base64").toString("utf8"), sha: result.sha };
  } catch (error) {
    if (error instanceof GitHubError)
      throw new GitHubError(error.status, `reading ${path} at ${ref}`);
    throw error;
  }
}
export async function head(ref: string) {
  const result = await github<{ sha: string }>(`/commits/${encodeURIComponent(ref)}`);
  return result.sha;
}
export async function isAncestor(ancestor: string, descendant: string) {
  if (ancestor === descendant) return true;
  const result = await github<{ status: string }>(
    `/compare/${encodeURIComponent(ancestor)}...${encodeURIComponent(descendant)}`,
  );
  return result.status === "ahead" || result.status === "identical";
}
