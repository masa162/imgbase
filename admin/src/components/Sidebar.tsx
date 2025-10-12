"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Route } from "next";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems: Array<{ href: Route; label: string; icon: string }> = [
    { href: "/" as Route, label: "画像ライブラリ", icon: "🖼️" },
    { href: "/upload" as Route, label: "アップロード", icon: "📤" },
    { href: "/converter" as Route, label: "ローカル画像変換ツール", icon: "🔧" }
  ];

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        className="hamburger-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="メニュー"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      {isOpen && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
      )}

      <aside className={isOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div style={logoContainerStyle}>
          <Link href={"/" as Route} style={logoLinkStyle} onClick={handleNavClick}>
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
                onClick={handleNavClick}
              >
                <span style={navIconStyle}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

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
