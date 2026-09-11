import "server-only";
import { put } from "@vercel/blob";
import { env } from "@/env";

export async function putBlob(
  pathname: string,
  body: Parameters<typeof put>[1],
  options: Omit<NonNullable<Parameters<typeof put>[2]>, "token"> = {},
) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return put(pathname, body, { access: "private", ...options, token });
}
