import type { Netlist } from "./easyeda";

export interface SavedProject {
  id: string;
  name: string;
  savedAt: number;
  netlist: Netlist;
  image?: string | null;
}

const KEY = "circuit-vision.projects.v1";

const canUse = () => typeof window !== "undefined" && !!window.localStorage;

export function listProjects(): SavedProject[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedProject[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

function persist(projects: SavedProject[]) {
  window.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function getProject(id: string): SavedProject | null {
  return listProjects().find((p) => p.id === id) ?? null;
}

export function saveProject(input: {
  id?: string;
  name: string;
  netlist: Netlist;
  image?: string | null;
}): SavedProject {
  const projects = listProjects();
  const id = input.id ?? `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const project: SavedProject = {
    id,
    name: input.name.trim() || "Untitled schematic",
    savedAt: Date.now(),
    netlist: input.netlist,
    image: input.image ?? null,
  };
  const next = [project, ...projects.filter((p) => p.id !== id)];
  try {
    persist(next);
  } catch {
    // Storage full (usually the source image) — retry without the picture.
    persist([{ ...project, image: null }, ...projects.filter((p) => p.id !== id)]);
  }
  return project;
}

export function deleteProject(id: string) {
  if (!canUse()) return;
  persist(listProjects().filter((p) => p.id !== id));
}

export function renameProject(id: string, name: string) {
  if (!canUse()) return;
  persist(listProjects().map((p) => (p.id === id ? { ...p, name } : p)));
}

