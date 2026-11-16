/** The Arepo (prediction-market research) site lives under this prefix; `/` is the agency page. */
export const PM = "/predictionmarket";

/** Prefix an Arepo path: pm("/markets") -> "/predictionmarket/markets"; pm("/") -> "/predictionmarket". */
export function pm(path: string): string {
  if (path === "/" || path === "") return PM;
  return path.startsWith("/") ? `${PM}${path}` : `${PM}/${path}`;
}
