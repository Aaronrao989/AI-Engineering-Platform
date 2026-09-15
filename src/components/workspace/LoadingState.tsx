"use client";

import { Cpu } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Analysing with AI..." }: LoadingStateProps) {
  return (
    <div className="output-panel">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 2rem",
          gap: "1rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid var(--border-default)",
              borderTopColor: "var(--brand-primary)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <Cpu size={22} color="var(--brand-primary)" />
        </div>
        <div>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "0.25rem",
            }}
          >
            {message}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Powered by Groq · Qwen
          </div>
        </div>
      </div>
    </div>
  );
}
