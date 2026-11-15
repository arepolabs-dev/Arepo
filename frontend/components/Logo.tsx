/**
 * Arepo grid mark — a faithful reconstruction of the supplied brand logo
 * (`design-assets/brand/AREPO logo (no word).png`): a 5x5 grid of cells where the
 * second column and the second row are filled Arepo red, forming the brand's
 * offset cross; the remaining cells are outlined. The supplied artwork is set on
 * black with white outlines; because Arepo's identity is light-only, empty cells
 * are drawn with an ink hairline outline on a transparent ground and the red
 * cells are preserved exactly. The arrangement and the red glyph are unchanged.
 * See docs/brand-system.md.
 */
export const MARK_RED = "#E50C0E";
export const MARK_GRID = 5;
/**
 * Measured from the supplied PNG: each cell is about 0.7 of the pitch (a gap of about 0.4 of a
 * cell), square corners, outline about 6% of a cell. Units: cell 12, gap 5, so pitch 17.
 */
export const MARK_CELL = 12;
export const MARK_GAP = 5;
export const MARK_PITCH = MARK_CELL + MARK_GAP;
export const MARK_SIZE = MARK_GRID * MARK_CELL + (MARK_GRID - 1) * MARK_GAP; // 80
/** Outline width for large use; small sizes pass a heavier one so the hairline stays visible. */
export const MARK_STROKE = 0.8;

/** Second column (index 1) top-to-bottom and second row (index 1) left-to-right are red. */
export function isRedCell(row: number, col: number): boolean {
  return col === 1 || row === 1;
}

export function LogoMark({ size = 26, title, stroke = 2.2, onRed = false }: { size?: number; title?: string; stroke?: number; onRed?: boolean }) {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < MARK_GRID; row++) {
    for (let col = 0; col < MARK_GRID; col++) {
      const red = isRedCell(row, col);
      const inset = red ? 0 : stroke / 2;
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={col * MARK_PITCH + inset}
          y={row * MARK_PITCH + inset}
          width={MARK_CELL - inset * 2}
          height={MARK_CELL - inset * 2}
          fill={red ? (onRed ? "#FFFFFF" : MARK_RED) : "none"}
          stroke={red ? "none" : "currentColor"}
          strokeWidth={red ? 0 : stroke}
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
      className={onRed ? "text-white" : "text-arepo-ink"}
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
