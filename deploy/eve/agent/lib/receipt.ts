import { github } from "./github.js";

export type Receipt = {
  event: string;
  issue: number;
  status?: string;
  phase?: string;
  agentId?: string;
  runId?: string;
  candidate?: string;
  deadline?: number;
  error?: string;
  pr?: string;
  attention?: "owner" | "eve";
  recommendation?: string;
};

export function formatReceipt(receipt: Receipt): string {
  const lines = [
    "<!-- factory-receipt -->",
    `**Factory ${receipt.event}**`,
    `Issue: #${receipt.issue}`,
  ];
  if (receipt.status) lines.push(`Status: ${receipt.status}`);
  if (receipt.phase) lines.push(`Phase: ${receipt.phase}`);
  if (receipt.agentId) lines.push(`Agent: ${receipt.agentId}`);
  if (receipt.runId) lines.push(`Run: ${receipt.runId}`);
  if (receipt.candidate) lines.push(`Candidate: ${receipt.candidate}`);
  if (receipt.deadline) lines.push(`Deadline: ${new Date(receipt.deadline).toISOString()}`);
  if (receipt.attention)
    lines.push(
      receipt.attention === "owner"
        ? "Attention: owner — Eve is holding."
        : "Attention: Eve — coordinator may continue inside the approved contract.",
    );
  if (receipt.recommendation) lines.push(`Jev: ${receipt.recommendation}`);
  if (receipt.pr) lines.push(`PR: ${receipt.pr}`);
  if (receipt.error) lines.push(`Error: ${receipt.error}`);
  return lines.join("\n");
}

export async function postReceipt(
  issue: number,
  receipt: Omit<Receipt, "issue">,
  request: typeof github = github,
) {
  try {
    await request(`/issues/${issue}/comments`, "POST", {
      body: formatReceipt({ ...receipt, issue }),
    });
  } catch {
    // Receipts are the operator projection. A comment failure must not roll back a checkpoint.
  }
}
