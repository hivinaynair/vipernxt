import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product preview",
  description: "Local preview of the first product slice",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
