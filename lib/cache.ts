import { revalidateTag } from "next/cache";

export const CATALOG_TAG = "catalog";

/** Call after anything that changes what customers see (admin edits, settings, sync). Safe outside Next (tests/CLI). */
export function invalidateCatalog() {
  try {
    revalidateTag(CATALOG_TAG);
  } catch {
    /* not running inside Next: nothing cached to invalidate */
  }
}
