/**
 * Arepo grid mark — a faithful reconstruction of the supplied brand logo
 * (`design-assets/brand/AREPO logo (no word).png`): a 5x5 grid of cells where the
 * second column and the second row are filled Arepo red, forming the brand's
 * offset cross; the remaining cells are outlined rounded squares. "light" (default) is the
 * approved mark on the warm off-white ground; "dark" is the original artwork (white outlines on ink).
 * See docs/brand-system.md.
 */
export const MARK_RED = "#E50C0E";
export const MARK_GRID = 5;
/**
 * Brand geometry, copied from the approved mark (TENET Brand/arepo/arepo-mark-light.svg, 7 Nov):
 * cell 36, gap 7, outline 7, corner radius 6. Every cell is a rounded square; never sharp corners.
 */
export const MARK_CELL = 36;
export const MARK_GAP = 7;
export const MARK_PITCH = MARK_CELL + MARK_GAP;
export const MARK_SIZE = MARK_GRID * MARK_CELL + (MARK_GRID - 1) * MARK_GAP; // 208
export const MARK_STROKE = 7;
export const MARK_RADIUS = 6;
/** Empty-cell outline: warm grey on the light ground, white on ink (the original artwork). */
export const MARK_OUTLINE = { light: "#D6D2CB", dark: "#FFFFFF" } as const;

/** Second column (index 1) top-to-bottom and second row (index 1) left-to-right are red. */
export function isRedCell(row: number, col: number): boolean {
  return col === 1 || row === 1;
}

export function LogoMark({ size = 26, title, variant = "light" }: { size?: number; title?: string; variant?: "light" | "dark" }) {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < MARK_GRID; row++) {
    for (let col = 0; col < MARK_GRID; col++) {
      const red = isRedCell(row, col);
      const inset = red ? 0 : MARK_STROKE / 2;
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={col * MARK_PITCH + inset}
          y={row * MARK_PITCH + inset}
          width={MARK_CELL - inset * 2}
          height={MARK_CELL - inset * 2}
          rx={red ? MARK_RADIUS : MARK_RADIUS - MARK_STROKE / 2}
          fill={red ? MARK_RED : "none"}
          stroke={red ? "none" : MARK_OUTLINE[variant]}
          strokeWidth={red ? 0 : MARK_STROKE}
        />
      );
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {cells}
    </svg>
  );
}

/**
 * Full lockup: grid mark + the AREPO wordmark set in the geometric display face
 * (Jost), uppercase with wide tracking to echo the supplied wordmark asset.
 */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none text-arepo-ink">
      <LogoMark size={size} title="Arepo" />
      <span className="font-display text-[21px] font-semibold uppercase tracking-[0.2em] text-arepo-ink">
        Arepo
      </span>
    </span>
  );
}
