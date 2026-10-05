// Keys of the catalog designs selectable in Settings (stored in Client.activeDesign).
// The matching React components live in designs/<key>/ and are mapped in designs/registry.ts.
export const DESIGNS = [
  { key: "grid", label: "Grid catalog", description: "Image-first product grid: sticky search, category chips, 2-4 column cards, stacked gallery on product pages." },
  { key: "showcase", label: "Showcase catalog", description: "Editorial list: category tree sidebar, wide row cards, split product page with side thumbnails and a sticky info panel." }
] as const;

export type DesignKey = (typeof DESIGNS)[number]["key"];
export const DESIGN_KEYS = DESIGNS.map((d) => d.key) as [DesignKey, ...DesignKey[]];
export const isDesignKey = (k: string): k is DesignKey => (DESIGN_KEYS as string[]).includes(k);
