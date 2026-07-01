import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initHeroIntro(selector: string) {
  if (prefersReducedMotion()) {
    return;
  }

  gsap.from(selector, {
    y: 24,
    opacity: 0,
    duration: 0.3,
    ease: "power4.out",
    stagger: 0.06,
  });
}

export function initHeroChoreography() {
  if (prefersReducedMotion()) {
    gsap.set([".hero-eyebrow", ".hero-h1", ".hero-sub", ".hero-actions", "#scroll-hint"], {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
    });
    return;
  }

  const timeline = gsap.timeline({ delay: 0.2 });
  timeline
    .fromTo(
      ".hero-eyebrow",
      { opacity: 0, y: 12, filter: "blur(4px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" },
    )
    .fromTo(
      ".hero-h1",
      { opacity: 0, y: 24, filter: "blur(8px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out" },
      "-=0.45",
    )
    .fromTo(
      ".hero-sub",
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
      "-=0.55",
    )
    .fromTo(
      ".hero-actions",
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
      "-=0.45",
    )
    .fromTo("#scroll-hint", { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.2");
}

export function initSectionReveals(selector: string) {
  if (prefersReducedMotion()) {
    return;
  }

  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    gsap.from(element, {
      y: 28,
      opacity: 0,
      duration: 0.3,
      ease: "power4.out",
      scrollTrigger: {
        trigger: element,
        start: "top 78%",
      },
    });
  });
}

export function initCounters(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    const target = Number(element.dataset.value ?? "0");
    const prefix = element.dataset.prefix ?? "";
    const suffix = element.dataset.suffix ?? "";

    if (!Number.isFinite(target) || prefersReducedMotion()) {
      element.textContent = `${prefix}${Math.round(Number.isFinite(target) ? target : 0).toLocaleString()}${suffix}`;
      return;
    }

    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: element,
        start: "top 86%",
        once: true,
      },
      onUpdate: () => {
        element.textContent = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
      },
    });
  });
}

export function animateCounter(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    const target = Number(element.dataset.target ?? element.dataset.value ?? "0");
    const decimals = Number(element.dataset.decimals ?? "0");
    const prefix = element.dataset.prefix ?? "";
    const suffix = element.dataset.suffix ?? "";

    if (!Number.isFinite(target) || prefersReducedMotion()) {
      element.textContent = `${prefix}${formatCounter(Number.isFinite(target) ? target : 0, decimals)}${suffix}`;
      return;
    }

    const counter = { value: 0 };
    ScrollTrigger.create({
      trigger: element,
      start: "top 88%",
      once: true,
      onEnter: () => {
        element.style.filter = "blur(6px)";
        element.style.opacity = "0.3";

        gsap.to(element, {
          filter: "blur(0px)",
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
        });

        gsap.to(counter, {
          value: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => {
            element.textContent = `${prefix}${formatCounter(counter.value, decimals)}${suffix}`;
          },
          onComplete: () => {
            element.textContent = `${prefix}${formatCounter(target, decimals)}${suffix}`;
          },
        });
      },
    });
  });
}

export function initStepStagger(selector: string, triggerSelector: string) {
  if (prefersReducedMotion()) {
    return;
  }

  gsap.utils.toArray<HTMLElement>(selector).forEach((element, index) => {
    gsap.fromTo(
      element,
      { opacity: 0, y: 24, rotateX: 8 },
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        duration: 0.7,
        delay: index * 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: triggerSelector,
          start: "top 82%",
        },
      },
    );
  });
}

export function initDatasetCardStagger(selector: string, triggerSelector: string) {
  if (prefersReducedMotion()) {
    return;
  }

  const elements = gsap.utils.toArray<HTMLElement>(selector);
  const staggerDelay = elements.length > 1 ? 0.45 / (elements.length - 1) : 0;

  elements.forEach((element, index) => {
    gsap.fromTo(
      element,
      { opacity: 0, y: 28, scale: 0.97 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        delay: index * staggerDelay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: triggerSelector,
          start: "top 84%",
        },
      },
    );
  });
}

export function initCtaEntrance() {
  if (prefersReducedMotion()) {
    gsap.set([".cta-inner h2", ".cta-inner p", ".cta-actions .stash-button"], {
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
    });
    return;
  }

  ScrollTrigger.create({
    trigger: ".cta-section",
    start: "top 75%",
    once: true,
    onEnter: () => {
      const timeline = gsap.timeline();
      timeline
        .fromTo(
          ".cta-inner h2",
          { opacity: 0, y: 24, filter: "blur(6px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.75, ease: "power3.out" },
        )
        .fromTo(
          ".cta-inner p",
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
          "-=0.45",
        )
        .fromTo(
          ".cta-actions .stash-button[data-variant='primary']",
          { opacity: 0, x: -12 },
          { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" },
          "-=0.4",
        )
        .fromTo(
          ".cta-actions .stash-button[data-variant='ghost']",
          { opacity: 0, x: 12 },
          { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" },
          "-=0.4",
        );
    },
  });
}

export function initFooterLinks(selector: string) {
  if (prefersReducedMotion()) {
    return;
  }

  gsap.fromTo(
    selector,
    { opacity: 0, y: 8 },
    {
      opacity: 1,
      y: 0,
      stagger: 0.06,
      duration: 0.4,
      ease: "power2.out",
      scrollTrigger: {
        trigger: "footer",
        start: "top 95%",
      },
    },
  );
}

export function initScrollHintFade(selector: string) {
  if (prefersReducedMotion()) {
    return;
  }

  gsap.to(selector, {
    opacity: 0,
    y: 8,
    ease: "power2.out",
    scrollTrigger: {
      trigger: document.body,
      start: "top -16",
      end: "top -120",
      scrub: true,
    },
  });
}

export function initSectionEyebrows(selector: string): () => void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (!elements.length) {
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.35 },
  );

  elements.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
}

export function initStatementLines(selector: string) {
  if (prefersReducedMotion()) {
    document.querySelectorAll<HTMLElement>(selector).forEach((line) => line.classList.add("lit"));
    return;
  }

  document.querySelectorAll<HTMLElement>(selector).forEach((line) => {
    ScrollTrigger.create({
      trigger: line,
      start: "top 68%",
      end: "top 38%",
      onEnter: () => line.classList.add("lit"),
      onLeaveBack: () => line.classList.remove("lit"),
      onEnterBack: () => line.classList.add("lit"),
      onLeave: () => line.classList.remove("lit"),
    });
  });
}

export function cleanupScrollTriggers() {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
}

function formatCounter(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
