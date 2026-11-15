"use client";

/**
 * Scroll-driven motion for the agency landing page. Every effect is skipped when the visitor
 * prefers reduced motion: content renders in its final state, Lenis is never started.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Lenis from "lenis";

/** Smooth, inertial scrolling (Lenis). Mounted once in the page; renders nothing. */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.12 });
    return () => lenis.destroy();
  }, [reduce]);
  return null;
}

/** Fades and rises into place the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section" | "h2" | "p";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
}

/** A line of words that slides sideways as the page scrolls. */
export function ScrollTicker({ items }: { items: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], ["4%", "-28%"]);
  const row = [...items, ...items, ...items];
  return (
    <div ref={ref} className="overflow-hidden border-y border-arepo-border py-5" aria-hidden="true">
      <motion.div
        style={reduce ? undefined : { x }}
        className="flex w-max gap-10 whitespace-nowrap font-display text-2xl font-medium uppercase tracking-[0.18em] text-arepo-muted sm:text-3xl"
      >
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10">
            {item}
            <span className="inline-block h-2 w-2 rounded-[2px] bg-arepo-accent" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Hero image: the Arepo grid mark grown into a 9 x 9 field, drawn by us (no stock). The filled
 * row and column echo the logo; a scattering of "jobs" light up and the whole field drifts and
 * tilts with the scroll. Pure SVG, so it is crisp at any size and weighs almost nothing.
 */
const GRID = 9;
const PITCH = 6;
const LIT = new Set(["3-5", "5-2", "6-6", "4-7", "7-3", "2-7", "6-0", "8-5"]);

export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, -6]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const cells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const key = `${r}-${c}`;
      const cross = r === 1 || c === 1;
      const lit = LIT.has(key);
      cells.push(
        <motion.rect
          key={key}
          x={c * PITCH + 0.5}
          y={r * PITCH + 0.5}
          width={4}
          height={4}
          rx={0.6}
          fill={cross ? "#E50C0E" : lit ? "#101010" : "none"}
          stroke={cross || lit ? "none" : "#D6D2CB"}
          strokeWidth={cross || lit ? 0 : 0.5}
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: reduce ? 0 : 0.015 * (r * GRID + c), ease: "easeOut" }}
          style={{ transformOrigin: `${c * PITCH + 2.5}px ${r * PITCH + 2.5}px` }}
        />,
      );
    }
  }
  const size = GRID * PITCH - 1;
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[520px]">
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        className="block h-auto w-full"
        style={reduce ? undefined : { y, rotate, scale }}
        role="img"
        aria-label="The Arepo grid: a field of small jobs, the ones in red taken care of."
      >
        {cells}
      </motion.svg>
    </div>
  );
}

/**
 * A founder's portrait. Shows `/team/<name>.jpg` from frontend/public/team/ when the file exists;
 * until then a monogram on the warm ground. Swap the photo in: no code change needed.
 */
export function Portrait({ src, alt, initials }: { src: string; alt: string; initials: string }) {
  const [missing, setMissing] = useState(false);
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative aspect-[4/5] w-full overflow-hidden rounded-card bg-arepo-surface2"
      initial={reduce ? false : { clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {missing ? (
        <div className="flex h-full w-full items-end p-5">
          <span className="font-display text-6xl font-semibold tracking-wide text-arepo-borderStrong">
            {initials}
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setMissing(true)}
        />
      )}
    </motion.div>
  );
}
