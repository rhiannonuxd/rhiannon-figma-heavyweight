/**
 * Regression measurements from `Rhiannon Resume_20260924205114.pdf`, page 1.
 *
 * The existing PDF content stream paints the lower U.S. Bank entry first (baseline 252), then the
 * higher Cloudflare entry (baseline 605). A raw extractor consequently reports U.S. Bank first.
 * PDF y grows upward, while Featherweight's TextRunSource offset is measured from the page top.
 */
export const RESUME_READING_ORDER = [
  { nodeId: 'us-bank', characters: 'U.S. Bank', x: 48, top: 792 - 252 },
  { nodeId: 'cloudflare', characters: 'Cloudflare', x: 48, top: 792 - 605 }
] as const
