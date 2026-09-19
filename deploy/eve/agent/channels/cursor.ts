import { defineChannel, POST } from "eve/channels";
import { resumeHook } from "workflow/api";
import { handleCallback, verifyCallback } from "../lib/callback.js";
import { required } from "../lib/config.js";
import { readState } from "../lib/store.js";
export default defineChannel({
  routes: [
    POST("/callbacks/cursor", async (request) =>
      handleCallback(request, {
        async active() {
          const b = (await readState()).state.batch;
          return b?.active ? { agentId: b.active.agentId, running: b.status === "running" } : null;
        },
        verify: (token, agentId) =>
          verifyCallback(token, required("FACTORY_CALLBACK_AUDIENCE"), agentId),
        async resume(agentId) {
          await resumeHook(`cursor:${agentId}`, { observed: "stop" });
        },
      }),
    ),
  ],
});
