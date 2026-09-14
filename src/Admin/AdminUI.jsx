import React from "react";
import { X } from "lucide-react";

/**
 * Admin Design System
 * Responsive version
 */

export const AT = {
  chrome: "#0F1520",
  chromeLight: "#1B2534",

  accent: "#2DD4BF",
  accentSoft: "#DCFBF6",
  accentDeep: "#0F766E",

  canvas: "#F4F6F8",
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

/* ================================================================
   PILL
================================================================ */

export function Pill({ tone }) {
  const map = {
    active: {
      bg: AT.successSoft,
      fg: AT.success,
    },

    published: {
      bg: AT.successSoft,
      fg: AT.success,
    },

    paid: {
      bg: AT.successSoft,
      fg: AT.success,
    },

    blocked: {
      bg: AT.dangerSoft,
      fg: AT.danger,
    },

    overdue: {
      bg: AT.dangerSoft,
      fg: AT.danger,
    },

    draft: {
      bg: AT.line,
      fg: AT.sub,
    },

    due: {
      bg: AT.warnSoft,
      fg: AT.warn,
    },

    "on leave": {
      bg: AT.warnSoft,
      fg: AT.warn,
    },
  };

  const key = String(tone).toLowerCase();

  const s =
    map[key] || {
      bg: AT.line,
      fg: AT.sub,
    };

  return (
    <span
      className="
        inline-block
        max-w-full
        truncate
        rounded-full
        px-2
        py-0.5
        text-xs
        font-medium
        capitalize
      "
      style={{
        background: s.bg,
        color: s.fg,
      }}
    >
      {tone}
    </span>
  );
}

/* ================================================================
   STAT CARD
================================================================ */

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}) {
  return (
    <div
      className="
        w-full
        min-w-0
        rounded-xl
        p-4
        sm:p-5
      "
      style={{
        background: AT.card,
        border: `1px solid ${AT.line}`,
      }}
    >
      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-3
        "
      >
        {/* Text */}

        <div className="min-w-0">
          <p
            className="
              truncate
              text-xs
              sm:text-sm
            "
            style={{
              color: AT.sub,
            }}
          >
            {label}
          </p>

          <p
            className="
              mt-1
              truncate
              text-xl
              font-semibold
              sm:text-2xl
            "
            style={{
              color: AT.ink,
            }}
          >
            {value}
          </p>

          {sub && (
            <p
              className="
                mt-1
                truncate
                text-[11px]
                sm:text-xs
              "
              style={{
                color: AT.success,
              }}
            >
              {sub}
            </p>
          )}
        </div>

        {/* Icon */}

        {Icon && (
          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-lg
              sm:h-10
              sm:w-10
            "
            style={{
              background: AT.accentSoft,
            }}
          >
            <Icon
              size={18}
              color={AT.accentDeep}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   CARD
================================================================ */

export function Card({
  title,
  action,
  children,
}) {
  return (
    <div
      className="
        w-full
        min-w-0
        overflow-hidden
        rounded-xl
      "
      style={{
        background: AT.card,
        border: `1px solid ${AT.line}`,
      }}
    >
      {(title || action) && (
        <div
          className="
            flex
            min-w-0
            flex-col
            gap-3
            border-b
            px-4
            py-3
            sm:flex-row
            sm:items-center
            sm:justify-between
            sm:px-5
            sm:py-4
          "
          style={{
            borderColor: AT.line,
          }}
        >
          {title && (
            <p
              className="
                min-w-0
                break-words
                text-sm
                font-semibold
              "
              style={{
                color: AT.ink,
              }}
            >
              {title}
            </p>
          )}

          {action && (
            <div
              className="
                flex
                w-full
                min-w-0
                flex-wrap
                items-center
                gap-2
                sm:w-auto
                sm:justify-end
              "
            >
              {action}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

/* ================================================================
   MODAL
================================================================ */

export function Modal({
  title,
  onClose,
  children,
}) {
  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        overflow-y-auto
        p-3
        sm:p-4
      "
      style={{
        background:
          "rgba(15,21,32,0.55)",
      }}
    >
      <div
        className="
          my-auto
          flex
          max-h-[calc(100vh-24px)]
          w-full
          max-w-md
          flex-col
          overflow-hidden
          rounded-xl
          shadow-xl
          sm:max-h-[calc(100vh-32px)]
        "
        style={{
          background: AT.card,
        }}
      >
        {/* Modal Header */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            gap-3
            border-b
            px-4
            py-3
            sm:px-5
            sm:py-4
          "
          style={{
            borderColor: AT.line,
          }}
        >
          <h3
            className="
              min-w-0
              break-words
              text-sm
              font-semibold
              sm:text-base
            "
            style={{
              color: AT.ink,
            }}
          >
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              transition
              hover:bg-slate-100
            "
            style={{
              color: AT.sub,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}

        <div
          className="
            min-h-0
            overflow-y-auto
            p-4
            sm:p-5
          "
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   FIELD
================================================================ */

export function Field({
  label,
  ...props
}) {
  return (
    <label className="mb-3 block w-full text-sm">
      <span
        className="
          mb-1
          block
          text-xs
          font-medium
          sm:text-sm
        "
        style={{
          color: AT.ink,
        }}
      >
        {label}
      </span>

      <input
        {...props}
        className="
          w-full
          min-w-0
          rounded-lg
          border
          px-3
          py-2.5
          text-sm
          outline-none
          transition
          focus:ring-2
        "
        style={{
          borderColor: AT.line,
          "--tw-ring-color": AT.accent,
        }}
      />
    </label>
  );
}

/* ================================================================
   PRIMARY BUTTON
================================================================ */

export function PrimaryButton({
  children,
  ...props
}) {
  return (
    <button
      {...props}
      className={`
        inline-flex
        min-h-[40px]
        items-center
        justify-center
        gap-1.5
        rounded-lg
        px-3
        py-2
        text-sm
        font-medium
        text-white
        transition
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${props.className || ""}
      `}
      style={{
        background: AT.chrome,
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

/* ================================================================
   GHOST BUTTON
================================================================ */

export function GhostButton({
  children,
  ...props
}) {
  return (
    <button
      {...props}
      className={`
        inline-flex
        min-h-[40px]
        items-center
        justify-center
        gap-1.5
        rounded-lg
        border
        px-4
        py-2
        text-sm
        transition
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${props.className || ""}
      `}
      style={{
        borderColor: AT.line,
        color: AT.ink,
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

/* ================================================================
   DANGER BUTTON
================================================================ */

export function DangerButton({
  children,
  ...props
}) {
  return (
    <button
      {...props}
      className={`
        inline-flex
        min-h-[40px]
        items-center
        justify-center
        gap-1.5
        rounded-lg
        px-4
        py-2
        text-sm
        font-medium
        text-white
        transition
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${props.className || ""}
      `}
      style={{
        background: AT.danger,
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

/* ================================================================
   EMPTY STATE
================================================================ */

export function EmptyState({
  text,
}) {
  return (
    <div
      className="
        px-4
        py-8
        text-center
        text-xs
        leading-5
        sm:py-10
        sm:text-sm
      "
      style={{
        color: AT.sub,
      }}
    >
      {text}
    </div>
  );
}

/* ================================================================
   CONFIRM DELETE MODAL
================================================================ */

export function ConfirmDeleteModal({
  name,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      title="Confirm delete"
      onClose={onCancel}
    >
      <p
        className="
          mb-5
          break-words
          text-sm
          leading-6
        "
        style={{
          color: AT.ink,
        }}
      >
        Remove{" "}
        <span className="font-medium">
          {name}
        </span>
        ? This can't be undone.
      </p>

      <div
        className="
          flex
          flex-col-reverse
          gap-2
          sm:flex-row
          sm:justify-end
        "
      >
        <GhostButton
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Cancel
        </GhostButton>

        <DangerButton
          onClick={onConfirm}
          className="w-full sm:w-auto"
        >
          Delete
        </DangerButton>
      </div>
    </Modal>
  );
}