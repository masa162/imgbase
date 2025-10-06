import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";

export const metadata: Metadata = {
  title: "imgbase Admin",
  description: "Manage the imgbase media library"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
