import { expect, test } from "bun:test";
// @ts-expect-error The portable Node hook is distributed as a standalone JS file.
import { notifyStop } from "../hooks/cursor-stop.mjs";

const config = { callbackUrl: "https://factory.example/callbacks/cursor" };
for (const status of ["completed", "aborted", "error"]) {
  test(`stop ${status} wakes without approving or requesting a follow-up`, async () => {
    const logs: string[] = [];
    const result = await notifyStop(
      { hook_event_name: "stop", status },
      {
        env: {},
        config,
        log: (s: string) => logs.push(s),
        exists: async (path: string) => {
          expect(path).toBe("/run/cursor/api.sock");
          return true;
        },
        mint: async (_: string, audience: string) => {
          expect(audience).toBe("https://factory.example");
          return "private-token";
        },
        send: async (_: URL, options: RequestInit) => {
          expect(options.redirect).toBe("error");
          expect(JSON.parse(options.body as string)).toEqual({ event: "stop", status });
          return new Response(null, { status: 202 });
        },
      },
    );
    expect(result).toEqual({});
    expect(logs.join(" ")).not.toContain("private-token");
  });
}
test("missing identity is observable and local runs do not send", async () => {
  const logs: string[] = [];
  expect(
    await notifyStop(
      { hook_event_name: "stop", status: "completed" },
      {
        env: {},
        exists: async () => false,
        log: (s: string) => logs.push(s),
        send: () => {
          throw new Error("must not send");
        },
      },
    ),
  ).toEqual({});
  expect(logs.join(" ")).toContain("socket unavailable");
});
test("rejects manual invocation without a real stop event", async () => {
  await expect(notifyStop({}, {})).rejects.toThrow("Invalid Cursor stop event");
});
test("transient callback failure retries but authorization denial does not", async () => {
  for (const status of [503, 403]) {
    let calls = 0;
    await expect(
      notifyStop(
        { hook_event_name: "stop", status: "completed" },
        {
          env: {},
          config,
          exists: async () => true,
          mint: async () => "private-token",
          log: () => {},
          wait: async () => {},
          send: async () => {
            calls++;
            return new Response(null, { status });
          },
        },
      ),
    ).rejects.toThrow("not acknowledged");
    expect(calls).toBe(status === 503 ? 3 : 1);
  }
});
test("standalone command consumes stdin and emits only hook JSON", async () => {
  const child = Bun.spawn(["node", new URL("../hooks/cursor-stop.mjs", import.meta.url).pathname], {
    env: { ...process.env, CURSOR_AGENT_SOCKET: "/tmp/vipernxt-no-such-socket" },
    stdin: new Response(
      JSON.stringify({ hook_event_name: "stop", status: "completed", workspace_roots: ["/tmp"] }),
    ),
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await new Response(child.stdout).text()).toBe("{}\n");
  expect(await child.exited).toBe(0);
  expect(await new Response(child.stderr).text()).toContain("socket unavailable");
});
