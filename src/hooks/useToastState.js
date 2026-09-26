import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

const DEFAULT_OPTIONS = {
  className: "lms-toast",
  bodyClassName: "lms-toast__body",
};

function normalizeMessage(message) {
  return String(message || "").trim();
}

function createToastId(type, message) {
  return `lms-${type}-${message.toLowerCase().replace(/\s+/g, " ")}`;
}

function showToast(type, message, options = {}) {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) return null;

  const toastId = options.toastId || createToastId(type, normalizedMessage);
  if (toast.isActive(toastId)) return toastId;

  const show = toast[type] || toast;
  return show(normalizedMessage, {
    ...DEFAULT_OPTIONS,
    ...options,
    toastId,
  });
}

export function useToastState(initialValue = "", type = "error") {
  const [value, setValue] = useState(initialValue);
  const lastToast = useRef("");

  useEffect(() => {
    const message = typeof value === "string" ? value.trim() : "";
    if (!message) {
      lastToast.current = "";
      return;
    }
    if (message === lastToast.current) return;
    lastToast.current = message;
    showToast(type, message);
  }, [type, value]);

  return [value, setValue];
}

export const notify = {
  success: (message, options) => showToast("success", message, options),
  error: (message, options) => showToast("error", message, options),
  info: (message, options) => showToast("info", message, options),
  warning: (message, options) => showToast("warning", message, options),
};

export function installToastAlertBridge() {
  const originalAlert = window.alert.bind(window);
  window.alert = (message) => showToast("info", message || "Notification");
  return () => {
    window.alert = originalAlert;
  };
}
