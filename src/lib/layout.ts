// Shared, format-neutral placement + routing.
// Everything is computed in whole grid "steps"; each exporter scales steps to
// its own unit (KiCad/EAGLE use 2.54 mm per step) so every wire endpoint always
// lands exactly on the raster grid.

import type { Netlist, NetlistComponent, NetlistPin } from "./easyeda";

export const STEP_MM = 2.54;

export interface LaidPin {
  component: string;
  number: string;
  name: string;
  side: "left" | "right";
  /** local pin tip offset from the component body origin, in steps */
  lx: number;
  ly: number;
  /** absolute pin tip, in steps */
  x: number;
  y: number;
}

export interface LaidComponent {
  comp: NetlistComponent;
  /** body top-left, in steps */
  x: number;
  y: number;
  w: number;
  h: number;
  pins: LaidPin[];
}

export interface LaidNet {
  name: string;
  segments: { x1: number; y1: number; x2: number; y2: number }[];
  junctions: { x: number; y: number }[];
  label: { x: number; y: number };
  pins: LaidPin[];
}

export interface Layout {
  components: LaidComponent[];
  nets: LaidNet[];
  width: number;
  height: number;
}

const CELL_W = 16;
const CELL_H = 12;
const MARGIN = 6;
const BODY_W = 6;
const LEAD = 2;
const PIN_SPACING = 2;
const raster = (value: number) => Math.round(value * 2) / 2;

function sideOf(pin: NetlistPin, index: number, total: number): "left" | "right" {
  if (pin.side) return pin.side;
  return index < Math.ceil(total / 2) ? "left" : "right";
}

export function layoutNetlist(netlist: Netlist): Layout {
  const count = netlist.components.length || 1;
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(count))));

  // New image extractions carry source geometry. Keep it verbatim rather than
  // replacing the photographed arrangement with a synthetic grid.
  const hasSourceGeometry = netlist.components.some((comp) => typeof comp.x === "number" && typeof comp.y === "number");
  if (hasSourceGeometry) {
    const width = 60;
    const height = 40;
    const components: LaidComponent[] = netlist.components.map((comp, index) => {
      const cx = raster((comp.x ?? ((index % cols) + 0.5) / cols) * width);
      const cy = raster((comp.y ?? (Math.floor(index / cols) + 0.5) / Math.ceil(count / cols)) * height);
      const w = raster(Math.max(4, (comp.width ?? 0.12) * width));
      const h = raster(Math.max(4, (comp.height ?? Math.max(0.14, comp.pins.length * 0.035)) * height));
      const left = comp.pins.filter((pin, pinIndex) => sideOf(pin, pinIndex, comp.pins.length) === "left");
      const right = comp.pins.filter((pin, pinIndex) => sideOf(pin, pinIndex, comp.pins.length) === "right");
      const pins = comp.pins.map((pin, pinIndex) => {
        const side = sideOf(pin, pinIndex, comp.pins.length);
        const list = side === "left" ? left : right;
        const row = list.indexOf(pin);
        const x = raster(typeof pin.x === "number" ? pin.x * width : cx + (side === "left" ? -w / 2 - 1 : w / 2 + 1));
        const y = raster(typeof pin.y === "number" ? pin.y * height : cy - h / 2 + ((row + 1) * h) / (list.length + 1));
        return { component: comp.id, number: pin.number, name: pin.name, side, lx: x - (cx - w / 2), ly: y - (cy - h / 2), x, y };
      });
      return { comp, x: cx - w / 2, y: cy - h / 2, w, h, pins };
    });
    const find = (component: string, pin: string) => components.flatMap((item) => item.pins).find((item) => item.component === component && item.number === pin);
    const nets: LaidNet[] = netlist.nets.map((net) => {
      const pins = net.connections.map((connection) => find(connection.component, connection.pin)).filter((pin): pin is LaidPin => Boolean(pin));
      if (net.paths?.length) {
        const paths = net.paths.map((path) => path.map((point) => ({ x: raster(point.x * width), y: raster(point.y * height) })));
        return {
          name: net.name,
          pins,
          segments: paths.flatMap((path) => path.slice(1).map((point, index) => ({ x1: path[index]?.x ?? point.x, y1: path[index]?.y ?? point.y, x2: point.x, y2: point.y }))),
          junctions: (net.junctions ?? []).map((point) => ({ x: raster(point.x * width), y: raster(point.y * height) })),
          label: net.label ? { x: raster(net.label.x * width), y: raster(net.label.y * height) } : { x: paths[0]?.[0]?.x ?? 1, y: (paths[0]?.[0]?.y ?? 2) - 1 },
        };
      }
      const trunkX = pins.length ? pins.reduce((sum, pin) => sum + pin.x, 0) / pins.length : 1;
      const top = pins.length ? Math.min(...pins.map((pin) => pin.y)) : 1;
      const bottom = pins.length ? Math.max(...pins.map((pin) => pin.y)) : top;
      return { name: net.name, pins, segments: [...(bottom > top ? [{ x1: trunkX, y1: top, x2: trunkX, y2: bottom }] : []), ...pins.filter((pin) => pin.x !== trunkX).map((pin) => ({ x1: pin.x, y1: pin.y, x2: trunkX, y2: pin.y }))], junctions: [], label: { x: trunkX, y: top - 1 } };
    }).filter((net) => net.pins.length >= 2);
    return { components, nets, width, height };
  }

  // Preserve the arrangement read from the picture, but snap into clean cells.
  const ordered = netlist.components
    .map((comp, idx) => ({ comp, idx }))
    .sort((a, b) => {
      const ay = a.comp.y ?? a.idx / count;
      const by = b.comp.y ?? b.idx / count;
      if (Math.abs(ay - by) > 0.08) return ay - by;
      const ax = a.comp.x ?? a.idx / count;
      const bx = b.comp.x ?? b.idx / count;
      if (ax !== bx) return ax - bx;
      return a.idx - b.idx;
    });

  const rows = Math.max(1, Math.ceil(ordered.length / cols));
  const components: LaidComponent[] = [];

  ordered.forEach(({ comp }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = MARGIN + col * CELL_W;
    const oy = MARGIN + row * CELL_H;

    const left: NetlistPin[] = [];
    const right: NetlistPin[] = [];
    comp.pins.forEach((p, idx) => {
      (sideOf(p, idx, comp.pins.length) === "left" ? left : right).push(p);
    });
    const pinRows = Math.max(left.length, right.length, 1);
    const h = pinRows * PIN_SPACING + 2;

    const pins: LaidPin[] = [];
    const emit = (list: NetlistPin[], side: "left" | "right") => {
      list.forEach((p, idx) => {
        const ly = 2 + idx * PIN_SPACING;
        const lx = side === "left" ? -LEAD : BODY_W + LEAD;
        pins.push({
          component: comp.id,
          number: p.number,
          name: p.name,
          side,
          lx,
          ly,
          x: ox + lx,
          y: oy + ly,
        });
      });
    };
    emit(left, "left");
    emit(right, "right");

    components.push({ comp, x: ox, y: oy, w: BODY_W, h, pins });
  });

  const find = (component: string, pin: string) => {
    for (const c of components) {
      const hit = c.pins.find((p) => p.component === component && p.number === pin);
      if (hit) return hit;
    }
    return undefined;
  };

  // One vertical corridor left of every column (and right of the last one).
  const channels: number[] = [];
  for (let c = 0; c <= cols; c += 1) channels.push(MARGIN + c * CELL_W - 4);
  const laneUsed = new Array(channels.length).fill(0) as number[];

  const nets: LaidNet[] = [];
  netlist.nets.forEach((net) => {
    const pins = net.connections
      .map((c) => find(c.component, c.pin))
      .filter((p): p is LaidPin => Boolean(p));
    if (pins.length < 2) return;

    const meanX = pins.reduce((s, p) => s + p.x, 0) / pins.length;
    let ch = 0;
    channels.forEach((cx, i) => {
      if (Math.abs(cx - meanX) < Math.abs((channels[ch] as number) - meanX)) ch = i;
    });
    const lane = laneUsed[ch] as number;
    laneUsed[ch] = lane + 1;
    const trunkX = (channels[ch] as number) + (lane % 3) - 1;

    const ys = pins.map((p) => p.y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);

    const segments: LaidNet["segments"] = [];
    if (bottom > top) segments.push({ x1: trunkX, y1: top, x2: trunkX, y2: bottom });
    const junctions: LaidNet["junctions"] = [];
    pins.forEach((p) => {
      if (p.x !== trunkX) segments.push({ x1: p.x, y1: p.y, x2: trunkX, y2: p.y });
      if (p.y !== top && p.y !== bottom) junctions.push({ x: trunkX, y: p.y });
    });

    nets.push({
      name: net.name,
      segments,
      junctions,
      label: { x: trunkX, y: top - 1 },
      pins,
    });
  });

  return {
    components,
    nets,
    width: MARGIN * 2 + cols * CELL_W,
    height: MARGIN * 2 + rows * CELL_H,
  };
}

/** Stable UUID derived from a string, so re-exports of the same schematic match. */
export function stableUuid(seed: string): string {
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < seed.length; i += 1) {
    h1 = (Math.imul(h1 ^ seed.charCodeAt(i), 2654435761) >>> 0) || 1;
    h2 = (Math.imul(h2 + seed.charCodeAt(i) + i, 1597334677) >>> 0) || 2;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  const raw = hex(h1) + hex(h2) + hex(h1 ^ h2) + hex(Math.imul(h1, h2));
  return [
    raw.slice(0, 8),
    raw.slice(8, 12),
    "4" + raw.slice(13, 16),
    "a" + raw.slice(17, 20),
    raw.slice(20, 32),
  ].join("-");
}

