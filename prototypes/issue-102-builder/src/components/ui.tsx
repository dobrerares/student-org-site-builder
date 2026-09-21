/** THROWAWAY prototype (issue #102) — small UI primitives, shadcn-flavoured. */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { LANG_LABEL, STATE_LABEL, type Lang, type PubState } from "../model";

/* ---------------- info icon (help behind an (i)) ---------------- */

/**
 * Openable help. Click, tap and keyboard (Enter/Space, because it is a real
 * <button>) all open it; Escape or an outside tap closes it and returns focus
 * to the icon.
 */
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <span className="info-wrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="info-btn"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`About ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <span className="info-pop" id={id} role="note">
          {children}
        </span>
      )}
    </span>
  );
}

/* ---------------- dialog ---------------- */

/** Modal dialog. Escape closes; focus moves in on open and back to the opener on close. */
export function Dialog({
  title,
  titleInfo,
  children,
  onClose,
  actions,
  wide,
}: {
  title: string;
  /** Longer explanation, shown behind an (i) next to the dialog's heading. */
  titleInfo?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not([disabled])",
    );
    (first ?? box.current)?.focus();
    return () => opener.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && box.current) {
        const items = Array.from(
          box.current.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={box}
        style={wide ? { width: "min(760px, 100%)" } : undefined}
      >
        <h2>
          {title}
          {titleInfo && <Info label={title.toLowerCase()}>{titleInfo}</Info>}
        </h2>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------------- toasts ---------------- */

export type Toast = { id: number; text: string; kind?: "ok" | "warn" | "info" };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  return { toasts, push, dismiss: (id: number) => setToasts((t) => t.filter((x) => x.id !== id)) };
}

export function ToastHost({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind}>
          <span>{t.text}</span>
          <button
            className="toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- odds and ends ---------------- */

export function StateBadge({ state }: { state: PubState }) {
  return (
    <span className={`badge badge-${state}`} title={`Publication state: ${STATE_LABEL[state]}`}>
      {STATE_LABEL[state]}
    </span>
  );
}

export function LangBadge({ lang }: { lang: Lang }) {
  return (
    <span className="badge badge-lang" title={`Language: ${LANG_LABEL[lang]}`}>
      {lang.toUpperCase()}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  info,
  children,
  hint,
}: {
  label: string;
  info?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <span className="field-label">
        {label}
        {info && <Info label={label.toLowerCase()}>{info}</Info>}
      </span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** True below the wide/phone breakpoint used by the stylesheet. */
export function useIsPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 860px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
