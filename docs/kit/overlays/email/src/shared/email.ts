import "server-only";
import { Resend } from "resend";
import { env } from "@/env";

let client: Resend | null | undefined;

export function getResend(): Resend | null {
  if (client !== undefined) return client;
  const key = env.RESEND_API_KEY;
  client = key ? new Resend(key) : null;
  return client;
}
