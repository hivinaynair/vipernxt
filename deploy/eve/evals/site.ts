/** A local HTTPS staging simulator. No hosted deployment or production database. */
import { spawn } from "node:child_process";

const [cert, key, candidate] = process.argv.slice(2);
if (!cert || !key || !/^[a-f0-9]{40}$/.test(candidate ?? ""))
  throw new Error("Invalid simulation site inputs");
const next = spawn(
  "bun",
  ["run", "--cwd", "apps/web", "dev", "--hostname", "127.0.0.1", "--port", "3180"],
  { stdio: "inherit" },
);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 3443,
  tls: { cert: Bun.file(cert), key: Bun.file(key) },
  async fetch(request) {
    const target = new URL(request.url);
    target.protocol = "http:";
    target.port = "3180";
    const upstream = new Headers(request.headers);
    upstream.set("host", target.host);
    upstream.delete("accept-encoding");
    const result = await fetch(target, { headers: upstream });
    const headers = new Headers(result.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.set("x-factory-candidate", candidate);
    return new Response(result.body, { status: result.status, headers });
  },
});
process.on("SIGTERM", () => {
  server.stop(true);
  next.kill();
  process.exit(0);
});
