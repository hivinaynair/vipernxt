"use client";

import NextError from "next/error";
import posthog from "posthog-js";
import { useEffect } from "react";
import { env } from "@/env";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    if (env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
