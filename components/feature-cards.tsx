"use client";

import React from "react";

export function FeatureCards() {
  return (
    <div style={{ background: "#f0ece3", padding: "0 0 0 0" }}>
      <div
        style={{
          background: "#f0ece3",
          padding: "40px 24px 50px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "28px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
        className="cards-section"
      >
        {/* Card 1: Online Account Access */}
        <div
          style={{
            background: "#fff",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.13)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
          }}
        >
          <img
            style={{
              width: "100%",
              height: "200px",
              objectFit: "cover",
              display: "block",
            }}
            src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80&auto=format&fit=crop"
            alt="Man on a rock with a tablet"
            onError={(e) => {
              e.currentTarget.src = "https://picsum.photos/600/200?grayscale";
            }}
          />
          <div
            style={{
              background: "#00b4c8",
              padding: "22px 24px 28px",
            }}
          >
            <h3
              style={{
                color: "#fff",
                fontSize: "17px",
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              Online Account Access
            </h3>
            <p
              style={{
                color: "#e8f9fb",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              24/7 access to account balances, claim submissions, and all things
              Capital One Verified!
            </p>
            <a
              href="#"
              style={{
                display: "inline-block",
                border: "2px solid #fff",
                color: "#fff",
                padding: "8px 22px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "lowercase",
                textDecoration: "none",
                borderRadius: "2px",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#00b4c8";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#fff";
              }}
            >
              learn more
            </a>
          </div>
        </div>

        {/* Card 2: Verified Benefits Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.13)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
          }}
        >
          <img
            style={{
              width: "100%",
              height: "200px",
              objectFit: "cover",
              display: "block",
            }}
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80&auto=format&fit=crop"
            alt="Group of happy children"
            onError={(e) => {
              e.currentTarget.src =
                "https://picsum.photos/600/200?grayscale&random=2";
            }}
          />
          <div
            style={{
              background: "#00b4c8",
              padding: "22px 24px 28px",
            }}
          >
            <h3
              style={{
                color: "#fff",
                fontSize: "17px",
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              Verified Benefits Card
            </h3>
            <p
              style={{
                color: "#e8f9fb",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              Don't wait for reimbursement!
            </p>
            <a
              href="#"
              style={{
                display: "inline-block",
                border: "2px solid #fff",
                color: "#fff",
                padding: "8px 22px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "lowercase",
                textDecoration: "none",
                borderRadius: "2px",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#00b4c8";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#fff";
              }}
            >
              learn more
            </a>
          </div>
        </div>

        {/* Card 3: FlexConnect */}
        <div
          style={{
            background: "#fff",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.13)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
          }}
        >
          <img
            style={{
              width: "100%",
              height: "200px",
              objectFit: "cover",
              display: "block",
            }}
            src="https://images.unsplash.com/photo-1531983412531-1f49a365ffed?w=600&q=80&auto=format&fit=crop"
            alt="Father and newborn baby"
            onError={(e) => {
              e.currentTarget.src =
                "https://picsum.photos/600/200?grayscale&random=3";
            }}
          />
          <div
            style={{
              background: "#00b4c8",
              padding: "22px 24px 28px",
            }}
          >
            <h3
              style={{
                color: "#fff",
                fontSize: "17px",
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              FlexConnect
            </h3>
            <p
              style={{
                color: "#e8f9fb",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              Link your FSA to your insurance and file claims instantly!
            </p>
            <a
              href="#"
              style={{
                display: "inline-block",
                border: "2px solid #fff",
                color: "#fff",
                padding: "8px 22px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "lowercase",
                textDecoration: "none",
                borderRadius: "2px",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#00b4c8";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#fff";
              }}
            >
              learn more
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
