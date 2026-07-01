import { useSyncExternalStore } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  createdAt: number;
}

export interface ToastInput {
  id?: string;
  tone?: ToastTone;
  title: string;
  body?: string;
}

type ToastListener = () => void;

const listeners = new Set<ToastListener>();
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();
let toasts: ToastRecord[] = [];

function createToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: ToastListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function dismissToast(id: string) {
  const timeout = timeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    timeouts.delete(id);
  }
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function showToast(input: ToastInput): string {
  const tone = input.tone ?? "info";
  const id = input.id ?? createToastId();
  const toast: ToastRecord = {
    id,
    tone,
    title: input.title,
    createdAt: Date.now(),
    ...(input.body ? { body: input.body } : {}),
  };

  toasts = [...toasts.filter((current) => current.id !== id), toast];
  emit();

  const duration = tone === "success" ? 3000 : tone === "error" ? 6000 : null;
  if (duration !== null) {
    const timeout = setTimeout(() => dismissToast(id), duration);
    timeouts.set(id, timeout);
  }

  return id;
}

export function useToast() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    toasts: snapshot,
    show: showToast,
    dismiss: dismissToast,
    success: (title: string, body?: string) => showToast({ tone: "success", title, ...(body ? { body } : {}) }),
    error: (title: string, body?: string) => showToast({ tone: "error", title, ...(body ? { body } : {}) }),
    info: (title: string, body?: string) => showToast({ tone: "info", title, ...(body ? { body } : {}) }),
  };
}
