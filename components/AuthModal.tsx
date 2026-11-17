"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

export type AuthUser = { id: number; email: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
};

export default function AuthModal({ open, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setPassword("");
      onSuccess(data.user as AuthUser);
    } catch {
      setError("Can't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1000, background: "rgba(10, 10, 30, 0.45)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="menu-glass w-full max-w-sm"
        style={{ padding: 28 }}
        aria-label={mode === "login" ? "Sign in" : "Create account"}
      >
        <h2 className="bg-gradient-to-r from-[var(--mint)] via-[var(--periwinkle)] to-[var(--rose)] bg-clip-text text-2xl font-bold text-transparent">
          PenLabs
        </h2>
        <p className="mb-5 mt-1 text-sm text-white/55">
          Sign in to save your notes to your account and use them on every device.
        </p>

        <div className="mb-5 flex gap-2">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`pill flex-1 py-1.5 text-sm transition ${
                mode === m ? "bg-white/25 text-white" : "text-white/55 hover:bg-white/15"
              }`}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              autoComplete="name"
              dir="auto"
              className="glass-input w-full px-4 py-2.5 text-sm placeholder:text-white/40"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            className="glass-input w-full px-4 py-2.5 text-sm placeholder:text-white/40"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            placeholder={mode === "register" ? "Password (at least 8 characters)" : "Password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="glass-input w-full px-4 py-2.5 text-sm placeholder:text-white/40"
          />
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="btn-accent mt-5 w-full py-2.5 text-sm disabled:opacity-60"
        >
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-1 text-xs text-white/45 hover:text-white/70"
        >
          Continue as guest
        </button>
      </form>
    </div>,
    document.body
  );
}