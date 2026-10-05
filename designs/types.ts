import type { ReactNode } from "react";
import type { ListItem, ProductDetail } from "@/lib/dto";
import type { CategoryNode, PublicClient } from "@/lib/catalog/queries";

/** Everything a design receives. Designs only present data: they never query the database themselves. */
export interface ShellProps { client: PublicClient; categories: CategoryNode[]; activeCategory?: string; q?: string; children: ReactNode }
export interface HomeProps {
  client: PublicClient; categories: CategoryNode[];
  activeCategory: CategoryNode | null; q: string; sort: string; inStock: boolean;
  items: ListItem[]; nextCursor: string | null;
  /** Query string (without cursor) the browser re-uses to load further pages from the internal API. */
  qs: string;
}
export interface DetailProps { client: PublicClient; product: ProductDetail; related: ListItem[] }
export interface Design { Shell: (p: ShellProps) => ReactNode; Home: (p: HomeProps) => ReactNode; Detail: (p: DetailProps) => ReactNode; label: string }
