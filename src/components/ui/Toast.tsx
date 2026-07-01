import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useToast, type ToastTone } from "./useToast";

interface ToastViewportProps {
  className?: string;
}

const accentClass: Record<ToastTone, string> = {
  success: "bg-success",
  error: "bg-error",
  info: "bg-accent",
};

export function ToastViewport({ className = "" }: ToastViewportProps) {
  const { toasts, dismiss } = useToast();

  return (
    <div className={clsx("fixed bottom-6 right-6 z-50 flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-2", className)}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial="initial"
            animate="animate"
            exit="exit"
            variants={{
              initial: { x: 48, opacity: 0 },
              animate: {
                x: 0,
                opacity: 1,
                transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
              },
              exit: {
                x: 48,
                opacity: 0,
                transition: { duration: 0.25, ease: [0.32, 0, 0.67, 0] },
              },
            }}
            className="flex max-w-sm items-start gap-3 rounded-xl border border-[var(--border)] bg-overlay p-4 shadow-lg"
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span className={clsx("w-0.5 self-stretch rounded-full", accentClass[toast.tone])} aria-hidden="true" />
            <div className="min-w-0 flex-1 pr-6">
              <p className="font-body text-sm font-medium text-t1">{toast.title}</p>
              {toast.body && <p className="mt-1 font-body text-sm font-light text-t2">{toast.body}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="rounded-full p-1 text-t3 transition-colors duration-150 ease-expo hover:text-t1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
