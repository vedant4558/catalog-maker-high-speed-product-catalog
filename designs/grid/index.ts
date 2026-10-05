import type { Design } from "../types";
import { GridShell } from "./Shell";
import { GridHome } from "./Home";
import { GridDetail } from "./Detail";
export const gridDesign: Design = { label: "Grid catalog", Shell: GridShell, Home: GridHome, Detail: GridDetail };
