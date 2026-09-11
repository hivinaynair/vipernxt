import "server-only";
import { put } from "@vercel/blob";
import { env } from "@/env";

type PutOptions = NonNullable<Parameters<typeof put>[2]>;

/**
 * `access` is required by @vercel/blob, so it cannot be part of an options bag
 * that defaults to `{}` — and spreading the caller's options over a default
 * `access` makes it ambiguous which one wins. Take it as an optional override
 * and resolve it explicitly.
 */
export async function putBlob(
  pathname: string,
  body: Parameters<typeof put>[1],
  options: Partial<Omit<PutOptions, "token">> = {},
) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return put(pathname, body, {
    ...options,
    access: options.access ?? "private",
    token,
  });
}
