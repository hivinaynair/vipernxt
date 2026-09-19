import { connectGitHubCredentials } from "@vercel/connect/eve";
export const GITHUB_CONNECTOR = process.env.GITHUB_CONNECTOR ?? "github/vipernxt-factory";
export const githubCredentials = connectGitHubCredentials(GITHUB_CONNECTOR);
export async function githubToken(): Promise<string> {
  const token = githubCredentials.installationToken;
  if (!token) throw new Error("GitHub installation token unavailable");
  return typeof token === "function" ? token() : token;
}
