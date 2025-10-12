"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import type { Route } from "next";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems: Array<{ href: Route; label: string; icon: string }> = [
    { href: "/" as Route, label: "アップロード", icon: "📤" },
    { href: "/converter" as Route, label: "ローカル画像変換ツール", icon: "🔧" }
  ];

  return (
    <aside style={sidebarStyle}>
      <div style={logoContainerStyle}>
        <Link href={"/" as Route} style={logoLinkStyle}>
          <img
            src="/logo.webp"
            alt="imgbase logo"
            style={logoImageStyle}
          />
        </Link>
      </div>

      <nav style={navStyle}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "nav-item nav-item-active" : "nav-item"}
            >
              <span style={navIconStyle}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

const sidebarStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "280px",
  height: "100vh",
  background: "rgba(12, 21, 32, 0.95)",
  borderRight: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  flexDirection: "column",
  padding: "24px 0",
  zIndex: 100
};

const logoContainerStyle: CSSProperties = {
  padding: "0 24px 32px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
};

const logoLinkStyle: CSSProperties = {
  display: "block",
  textDecoration: "none"
};

const logoImageStyle: CSSProperties = {
  width: "100%",
  height: "auto",
  display: "block"
};

const navStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "24px 16px",
  flex: 1
};

const navIconStyle: CSSProperties = {
  fontSize: "1.2rem",
  lineHeight: 1
};
