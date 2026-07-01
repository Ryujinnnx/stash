import { useLayoutEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export interface PageWrapperProps {
  children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const location = useLocation();
  const isFullBleed =
    location.pathname === "/" ||
    location.pathname === "/marketplace" ||
    location.pathname === "/upload" ||
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/dataset/");

  useLayoutEffect(() => {
    resetScrollPosition();
    const animationFrame = window.requestAnimationFrame(resetScrollPosition);
    const timeout = window.setTimeout(resetScrollPosition, 80);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="min-h-screen pt-14">
      {isFullBleed ? children : <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>}
    </div>
  );
}

function resetScrollPosition(): void {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
