"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cpu, Mail, Lock, Loader2 } from "lucide-react";
import type { Metadata } from "next";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password. Please try again.");
    } else {
      router.push("/platform/dashboard");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Cpu size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              AI Engineering Platform
            </div>
          </div>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account to continue</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="email">Email address</label>
            <div style={{ position: "relative" }}>
              <Mail
                size={15}
                style={{
                  position: "absolute",
                  left: "0.875rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                id="email"
                type="email"
                className="input"
                style={{ paddingLeft: "2.5rem" }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <Lock
                size={15}
                style={{
                  position: "absolute",
                  left: "0.875rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                id="password"
                type="password"
                className="input"
                style={{ paddingLeft: "2.5rem" }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            style={{ marginTop: "1.5rem" }}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            marginTop: "1.5rem",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--brand-primary)", fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
