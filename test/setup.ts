import { afterAll, afterEach, beforeAll, expect, mock } from "bun:test";
import { server } from "@repo/mocks/server";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";

/**
 * `server-only` throws on import unless the bundler supplies the `react-server`
 * export condition. Journey steps that touch data are server modules -- a db
 * query, a server action -- so without this they cannot be tested at all, and
 * the step ids the merge bar wants cited have nowhere to be cited from.
 *
 * Setting the condition globally is not the fix: it makes react-dom/client
 * unavailable, which breaks every component test in the same run. Stubbing the
 * guard leaves both kinds of test working in one `bun test`.
 */
mock.module("server-only", () => ({}));

expect.extend(matchers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
