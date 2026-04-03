import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "TeamSage - GenAI Knowledge Assistant",
  description:
    "Index company PDFs, DOCX, PPTX, audio, and meetings; get RAG-powered answers with source-grounded insights and summaries.",
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
