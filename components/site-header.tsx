"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { restartFromGate } from "@/lib/restart-gate";
import { SITE_DISPLAY_NAME } from "@/lib/site-url";

export function SiteHeader() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  return (
    <header
      style={{
        background: "#fff",
        borderBottom: "3px solid #00b4c8",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
        position: "relative",
        zIndex: 10,
      }}
      className="site-header"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
        }}
      >
        <button type="button" onClick={restartFromGate} className="bg-transparent border-0 p-0">
        <img
          src="/emp/images/logo.png"
          alt={SITE_DISPLAY_NAME}
          style={{ height: "42px", width: "auto" }}
        />
        </button>
      </div>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {isLandingPage && (
          <div
            style={{
              display: "flex",
              gap: "5px",
              alignItems: "center",
              marginRight: "6px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#00b4c8",
                display: "block",
              }}
            ></span>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#00b4c8",
                display: "block",
              }}
            ></span>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#00b4c8",
                display: "block",
              }}
            ></span>
          </div>
        )}
        {isLandingPage && (
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "1px",
              color: "#555",
              textTransform: "uppercase",
              marginRight: "10px",
              cursor: "pointer",
            }}
            className="menu-label"
          >
            Menu
          </span>
        )}
        {isLandingPage && (
          <>
            <a
              href="#"
              style={{
                background: "#c0392b",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
                transition: "background 0.2s",
              }}
            >
              log in →
            </a>
            <a
              href="#"
              style={{
                background: "#c0392b",
                color: "#fff",
                border: "2px solid #c0392b",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: "3px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              register ↑
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
