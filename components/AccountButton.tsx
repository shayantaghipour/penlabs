"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AuthUser } from "./AuthModal";

type Props = {
  user: AuthUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
};

const MENU_WIDTH = 240;

export default function AccountButton({ user, onSignIn, onSignOut }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="pill shrink-0 px-3 py-1.5 text-xs text-white/70 hover:bg-white/15"
      >
        Sign in
      </button>
    );
  }

  const initial = (user.name || user.email).trim().charAt(0).toUpperCase() || "?";

  function toggle() {
    if (open) return setPos(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(12, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 12));
    setPos({ top: r.bottom + 10, left });
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Account"
        className="btn-accent flex h-8 w-8 shrink-0 items-center justify-center text-sm"
      >
        {initial}
      </button>

      {pos &&
        createPortal(
          <div
            ref={menuRef}
            className="menu-glass"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH, zIndex: 1000 }}
          >
            <div className="px-3 pb-2 pt-3">
              {user.name && (
                <p dir="auto" className="truncate text-sm font-medium text-white/90">
                  {user.name}
                </p>
              )}
              <p className="truncate text-xs text-white/50">{user.email}</p>
            </div>
            <button
              onClick={() => {
                setPos(null);
                onSignOut();
              }}
              className="glass-item w-full px-3 py-2.5 text-left text-sm text-rose-300"
            >
              Sign out
            </button>
          </div>,
          document.body
        )}
    </>
  );
}