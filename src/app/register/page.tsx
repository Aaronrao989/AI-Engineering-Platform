"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cpu, User, Mail, Lock, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Registration failed.");
      return;
    }

    // Auto-redirect to login after successful registration
    router.push("/login?registered=true");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
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

        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Get started with AI-powered engineering</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="name">Full name</label>
            <div style={{ position: "relative" }}>
              <User
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
                id="name"
                type="text"
                className="input"
                style={{ paddingLeft: "2.5rem" }}
                placeholder="Aaron Rao"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>

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
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
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
                Creating account...
              </>
            ) : (
              "Create account"
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
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--brand-primary)", fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
