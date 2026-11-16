import type { MetadataRoute } from "next";
import { PM } from "@/lib/paths";

const BASE = "https://www.arepolabs.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${BASE}/` }, { url: `${BASE}${PM}` }];
}
