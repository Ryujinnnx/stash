import type { ReactNode } from "react";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { clsx } from "clsx";

export interface MobileNavLink {
  to: string;
  label: string;
}

export interface MobileDrawerProps {
  open: boolean;
  links: MobileNavLink[];
  walletSlot: ReactNode;
  onClose: () => void;
}

export function MobileDrawer({ open, links, walletSlot, onClose }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] backdrop-blur-sm md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onMouseDown={onClose}
        >
          <motion.aside
            aria-label="Mobile navigation"
            className="fixed right-0 top-0 flex h-dvh w-72 flex-col border-l border-[var(--border)] bg-overlay p-6 shadow-lg"
            initial={{ x: 288 }}
            animate={{ x: 0 }}
            exit={{ x: 288 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <LogoMark />
                <span className="font-display text-base font-medium text-t1">Stash</span>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full text-t2 transition-colors duration-150 ease-expo hover:bg-raised hover:text-t1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="mt-12 grid gap-5">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      "font-display text-xl font-normal transition-colors duration-150 ease-expo hover:text-t1",
                      isActive ? "text-t1" : "text-t2",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto border-t border-[var(--border)] pt-5">{walletSlot}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LogoMark() {
  return (
    <span className="grid h-[22px] w-[22px] grid-cols-2 gap-0.5 rounded-md" aria-hidden="true">
      <span className="rounded-[2px] bg-accent" />
      <span className="rounded-[2px] bg-accent opacity-75" />
      <span className="rounded-[2px] bg-accent opacity-75" />
      <span className="rounded-[2px] bg-accent" />
    </span>
  );
}
