"use client";

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { SessionProvider } from "next-auth/react";

// Note: Can't use metadata with "use client", but it's required for SessionProvider
const metadata: Metadata = {
  title: "SyncMind AI",
  description: "Smart Meeting & Lecture Assistant for Teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="animated-bg" />
        <SessionProvider>
          <AuthProvider>{children}</AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
