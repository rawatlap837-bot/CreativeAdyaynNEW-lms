import React from "react";
import { X } from "lucide-react";

/**
 * Admin design system
 * ─────────────────────
 * Deliberately distinct from the student side (violet #2E1A55 / indigo
 * #6D3FC0 / amber #E8A33D, warm + rounded). Admin reads as a control room:
 * cool slate background, near-black chrome, a single teal accent used only
 * for active/interactive state — so at a glance you always know which app
 * you're in.
 */
export const AT = {
  chrome: "#0F1520",      // sidebar / topbar
  chromeLight: "#1B2534", // hovered/active nav row
  accent: "#2DD4BF",      // teal — the one accent color
  accentSoft: "#DCFBF6",
  accentDeep: "#0F766E",
  canvas: "#F4F6F8",       // page background
  card: "#FFFFFF",
  ink: "#0F172A",
  sub: "#64748B",
  line: "#E2E8F0",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  success: "#059669",
  successSoft: "#D1FAE5",
  warn: "#B45309",
  warnSoft: "#FEF3C7",
};

export function Pill({ tone }) {
  const map = {
    active: { bg: AT.successSoft, fg: AT.success },
    published: { bg: AT.successSoft, fg: AT.success },
    paid: { bg: AT.successSoft, fg: AT.success },
    blocked: { bg: AT.dangerSoft, fg: AT.danger },
    overdue: { bg: AT.dangerSoft, fg: AT.danger },
    draft: { bg: AT.line, fg: AT.sub },
    due: { bg: AT.warnSoft, fg: AT.warn },
    "on leave": { bg: AT.warnSoft, fg: AT.warn },
  };
  const key = String(tone).toLowerCase();
  const s = map[key] || { bg: AT.line, fg: AT.sub };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium inline-block capitalize"
      style={{ background: s.bg, color: s.fg }}
    >
      {tone}
    </span>
  );
}

export function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="rounded-xl p-5" style={{ background: AT.card, border: `1px solid ${AT.line}` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: AT.sub }}>{label}</p>
          <p className="text-2xl font-semibold mt-1" style={{ color: AT.ink }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: AT.success }}>{sub}</p>}
        </div>
        {Icon && (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: AT.accentSoft }}>
            <Icon size={18} color={AT.accentDeep} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Card({ title, action, children }) {
  return (
    <div className="rounded-xl" style={{ background: AT.card, border: `1px solid ${AT.line}` }}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: AT.line }}>
          {title && <p className="text-sm font-semibold" style={{ color: AT.ink }}>{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,21,32,0.55)" }}>
      <div className="rounded-xl w-full max-w-md shadow-xl" style={{ background: AT.card }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: AT.line }}>
          <h3 className="font-semibold" style={{ color: AT.ink }}>{title}</h3>
          <button onClick={onClose} style={{ color: AT.sub }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, ...props }) {
  return (
    <label className="block mb-3 text-sm">
      <span className="block mb-1 font-medium" style={{ color: AT.ink }}>{label}</span>
      <input
        {...props}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
        style={{ borderColor: AT.line, "--tw-ring-color": AT.accent }}
      />
    </label>
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={"flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-white " + (props.className || "")}
      style={{ background: AT.chrome, ...(props.style || {}) }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={"text-sm px-4 py-2 rounded-lg border " + (props.className || "")}
      style={{ borderColor: AT.line, color: AT.ink, ...(props.style || {}) }}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={"text-sm px-4 py-2 rounded-lg text-white " + (props.className || "")}
      style={{ background: AT.danger, ...(props.style || {}) }}
    >
      {children}
    </button>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="px-4 py-10 text-center text-sm" style={{ color: AT.sub }}>
      {text}
    </div>
  );
}

export function ConfirmDeleteModal({ name, onCancel, onConfirm }) {
  return (
    <Modal title="Confirm delete" onClose={onCancel}>
      <p className="text-sm mb-4" style={{ color: AT.ink }}>
        Remove <span className="font-medium">{name}</span>? This can't be undone.
      </p>
      <div className="flex justify-end gap-2">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <DangerButton onClick={onConfirm}>Delete</DangerButton>
      </div>
    </Modal>
  );
}