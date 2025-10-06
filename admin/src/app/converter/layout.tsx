import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WebPローカル変換 | imgbase Admin",
  description: "ブラウザ内で完結するWebP変換ツール"
};

export default function ConverterLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="converter-shell">
      <nav className="converter-nav">
        <Link href="/">← 管理画面トップへ戻る</Link>
      </nav>
      {children}
    </div>
  );
}
