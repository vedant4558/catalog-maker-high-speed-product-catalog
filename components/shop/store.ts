"use client";
// Browser-side wishlist + enquiry selection. No accounts, no server state: localStorage, shared by every design,
// synced across tabs (storage event) and across components (useSyncExternalStore).
import { useSyncExternalStore } from "react";

const KEYS = { wishlist: "cm:wishlist:v1", enquiry: "cm:enquiry:v1" } as const;
export type ListName = keyof typeof KEYS;
const MAX = 100;
const EMPTY: string[] = [];
const cache: Partial<Record<ListName, { raw: string | null; value: string[] }>> = {};
const listeners = new Set<() => void>();

function read(name: ListName): string[] {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEYS[name]); } catch { /* private mode / blocked storage: behave as empty */ }
  const hit = cache[name];
  if (hit && hit.raw === raw) return hit.value; // stable reference => no needless re-renders
  let value = EMPTY;
  try { const v = raw ? JSON.parse(raw) : []; if (Array.isArray(v)) value = v.filter((x): x is string => typeof x === "string").slice(0, MAX); } catch { value = EMPTY; }
  cache[name] = { raw, value };
  return value;
}
function write(name: ListName, ids: string[]) {
  try { window.localStorage.setItem(KEYS[name], JSON.stringify(ids.slice(0, MAX))); } catch { /* storage full/blocked */ }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") window.addEventListener("storage", (e) => { if (Object.values(KEYS).includes(e.key as never)) listeners.forEach((l) => l()); });

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function useList(name: ListName): string[] {
  return useSyncExternalStore(subscribe, () => read(name), () => EMPTY);
}
export const getList = read;
export const toggleId = (name: ListName, id: string) => { const cur = read(name); write(name, cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]); };
export const addIds = (name: ListName, ids: string[]) => write(name, [...new Set([...ids, ...read(name)])]);
export const removeId = (name: ListName, id: string) => write(name, read(name).filter((x) => x !== id));
export const removeIds = (name: ListName, ids: string[]) => write(name, read(name).filter((x) => !ids.includes(x)));
export const clearList = (name: ListName) => write(name, []);
