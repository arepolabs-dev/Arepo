"use client";

/**
 * Scroll-driven motion for the agency landing page. Scrolling itself is native (no smooth-scroll
 * library: Dayyan found it too fast and not intuitive, 15 Nov). Every effect is skipped when the
 * visitor prefers reduced motion: content renders in its final state.
 */
import { useRef, useState, type ReactNode } from "react";
import { MARK_CELL, MARK_GRID, MARK_PITCH, MARK_RED, MARK_SIZE, MARK_STROKE, isRedCell } from "@/components/Logo";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
}

/** A line of words that slides gently sideways as the page scrolls. */
export function ScrollTicker({ items }: { items: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], ["2%", "-14%"]);
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
 * Hero image: the real Arepo mark, big. A 5 x 5 grid where the 2nd column and the 2nd row are
 * filled Arepo red (the offset cross) and the other 16 cells are outlined in ink, exactly as in
 * `design-assets/brand/AREPO logo (no word).png` (and `components/Logo.tsx`). The cells pop in
 * one by one on load; the whole mark then drifts, tilts and settles a little as you scroll.
 * Pure SVG, so it is crisp at any size and weighs almost nothing.
 */
const GRID = MARK_GRID;
const PITCH = MARK_PITCH;
const CELL = MARK_CELL;
const STROKE = MARK_STROKE;
const RED = MARK_RED;
const INK = "#101010";

export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 48]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, -6]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  const cells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const red = isRedCell(r, c);
      const inset = red ? 0 : STROKE / 2;
      cells.push(
        <motion.rect
          key={`${r}-${c}`}
          x={c * PITCH + inset}
          y={r * PITCH + inset}
          width={CELL - inset * 2}
          height={CELL - inset * 2}
          fill={red ? RED : "none"}
          stroke={red ? "none" : INK}
          strokeWidth={red ? 0 : STROKE}
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: reduce ? 0 : 0.06 * (r * GRID + c), ease: "easeOut" }}
          style={{ transformOrigin: `${c * PITCH + CELL / 2}px ${r * PITCH + CELL / 2}px` }}
        />,
      );
    }
  }
  const size = MARK_SIZE;
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[480px]">
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        className="block h-auto w-full"
        style={reduce ? undefined : { y, rotate, scale }}
        role="img"
        aria-label="The Arepo mark: a 5 by 5 grid with 1 row and 1 column in red."
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
