import { defineChannel, POST } from "eve/channels";
import { repository } from "../lib/config.js";
import { OWNER_RETRY_PROMPT } from "../lib/owner-command.js";
import { handleSlackCallback, slackOwnerAuth } from "../lib/slack.js";
import github from "./github.js";

export default defineChannel({
  routes: [
    POST("/callbacks/slack", async (request, ctx) =>
      handleSlackCallback(request, {
        async dispatchRetry(issue, userId) {
          const [owner, repo] = repository().split("/");
          await ctx.to(github, { owner, repo, issueNumber: issue }).send(OWNER_RETRY_PROMPT, {
            auth: slackOwnerAuth(issue, userId),
          });
        },
      }),
    ),
  ],
});
