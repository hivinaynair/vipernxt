import { defineAgent } from "eve";
export default defineAgent({
  model: "openai/gpt-5.6-terra-fast",
  compaction: { thresholdPercent: 0.75 },
  limits: { maxOutputTokensPerSession: 8000 },
});
