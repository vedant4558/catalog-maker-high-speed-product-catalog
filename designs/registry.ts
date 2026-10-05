import type { Design } from "./types";
import { gridDesign } from "./grid";
import { showcaseDesign } from "./showcase";

/**
 * Design registry. Client.activeDesign (admin Settings) is looked up here.
 * To add Design 3: create designs/<key>/index.ts exporting a Design, add it below and to lib/designs.ts. No backend change.
 */
const registry: Record<string, Design> = { grid: gridDesign, showcase: showcaseDesign };
export const DEFAULT_DESIGN = "grid";
export const getDesign = (key: string | null | undefined): Design => registry[key ?? ""] ?? registry[DEFAULT_DESIGN];
