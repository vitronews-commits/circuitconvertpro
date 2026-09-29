// Converts a normalized netlist into an EasyEDA (Std v6) schematic JSON document.
import type { SymbolKind } from "./schematic-symbols";

export type PinSide = "left" | "right";

export interface NetlistPin {
  number: string;
  name: string;
  side?: PinSide;
  /** Exact normalized pin anchor detected in the source image. */
  x?: number;
  y?: number;
}

export interface NetlistPoint { x: number; y: number }

export interface NetlistComponent {
  id: string; // designator, e.g. R1
  type: string; // resistor / capacitor / ic / ...
  value?: string;
  part?: string; // matched library part name (MPN)
  lcsc?: string; // LCSC SKU
  datasheet?: string;
  x?: number; // relative 0..1 position from the image
  y?: number;
  /** Clockwise orientation detected from the source schematic. */
  orientation?: 0 | 90 | 180 | 270;
  symbolKind?: SymbolKind;
  width?: number;
  height?: number;
  confidence?: number;
  reviewReason?: string;
  pins: NetlistPin[];
}


export interface NetlistNet {
  name: string;
  connections: { component: string; pin: string }[];
  /** Exact wire polylines and junctions detected in the source image. */
  paths?: NetlistPoint[][];
  junctions?: NetlistPoint[];
  label?: NetlistPoint;
  confidence?: number;
  reviewReason?: string;
}

export interface Netlist {
  title?: string;
  notes?: string;
  sourceStyle?: "hand-drawn" | "cad" | "unknown";
  components: NetlistComponent[];
  nets: NetlistNet[];
}

const GRID = 10;
const snap = (v: number) => Math.round(v / GRID) * GRID;

// A single affine map is shared by every source-image coordinate. Two decimal
// places retain small detected turns without independently snapping endpoints.
const SOURCE_X = 1200;
const SOURCE_Y = 800;
const SOURCE_MARGIN_X = 140;
const SOURCE_MARGIN_Y = 120;
const sourceNumber = (value: number) => Math.round(value * 100) / 100;
const sourcePoint = (point: NetlistPoint): NetlistPoint => ({
  x: sourceNumber(SOURCE_MARGIN_X + point.x * SOURCE_X),
  y: sourceNumber(SOURCE_MARGIN_Y + point.y * SOURCE_Y),
});
const validPoint = (point: NetlistPoint | undefined): point is NetlistPoint =>
  !!point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
  point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

interface PlacedPin {
  key: string;
  x: number;
  y: number;
}

function pinSide(pin: NetlistPin, index: number, total: number): PinSide {
  if (pin.side) return pin.side;
  return index < Math.ceil(total / 2) ? "left" : "right";
}

function symbolShape(
  comp: NetlistComponent,
  originX: number,
  originY: number,
  ggeSeed: number,
  placed: PlacedPin[],
): string {
  const left = comp.pins.filter((p, i) => pinSide(p, i, comp.pins.length) === "left");
  const right = comp.pins.filter((p, i) => pinSide(p, i, comp.pins.length) === "right");
  const rows = Math.max(left.length, right.length, 1);
  const w = 120;
  const h = rows * 30 + 20;

  const parts: string[] = [];
  parts.push(
    `R~${originX}~${originY}~~~${w}~${h}~#880000~1~0~none~gge${ggeSeed}~0~`,
  );
  parts.push(
    `T~N~${originX}~${originY - 12}~0~#000080~~9pt~~~~~comment~${comp.id}~start~gge${ggeSeed + 1}~0~`,
  );
  if (comp.value) {
    parts.push(
      `T~N~${originX + w}~${originY - 12}~0~#000080~~9pt~~~~~comment~${comp.value}~end~gge${ggeSeed + 2}~0~`,
    );
  }

  let gge = ggeSeed + 3;
  const emit = (pins: NetlistPin[], side: PinSide) => {
    pins.forEach((p, i) => {
      const py = originY + 20 + i * 30;
      const px = side === "left" ? originX : originX + w;
      const tip = side === "left" ? px - 20 : px + 20;
      const rot = side === "left" ? 0 : 180;
      const path =
        side === "left" ? `M ${px} ${py} h -20` : `M ${px} ${py} h 20`;
      const clock = side === "left" ? `M ${px} ${py - 3} L ${px + 6} ${py} L ${px} ${py + 3}` : `M ${px} ${py - 3} L ${px - 6} ${py} L ${px} ${py + 3}`;
      parts.push(
        [
          `P~show~0~${p.number}~${tip}~${py}~${rot}~gge${gge}`,
          `^^${rot}~${tip}~${py}`,
          `^^${path}~#880000~1~0~none`,
          `^^1~${side === "left" ? px + 6 : px - 6}~${py + 3}~0~${p.name}~${side === "left" ? "start" : "end"}~~~#0000FF`,
          `^^1~${side === "left" ? tip - 4 : tip + 4}~${py - 4}~0~${p.number}~${side === "left" ? "end" : "start"}~~~#0000FF`,
          `^^0~${clock}~#880000~1~0`,
          `^^0~0~${px}~${py}~#880000~gge${gge}_dot`,
        ].join(""),
      );
      placed.push({ key: `${comp.id}.${p.number}`, x: tip, y: py });
      gge += 1;
    });
  };
  emit(left, "left");
  emit(right, "right");

  const head = `LIB~${originX}~${originY}~package\`\`nameDisplay\`\`spicePre\`${comp.id[0] ?? "U"}\`spiceSymbolName\`${comp.id}\`type\`${comp.type}~~~~gge${ggeSeed}~1~`;
  return head + parts.join("#@$");
}

/** Draw an absolute EasyEDA symbol around detected image bounds and pin tips. */
function sourceSymbolShape(comp: NetlistComponent, seed: number, placed: PlacedPin[]): string {
  const center = sourcePoint({ x: comp.x as number, y: comp.y as number });
  const orientation = comp.orientation ?? 0;
  const horizontal = orientation === 90 || orientation === 270;
  const boundsW = Math.max(12, sourceNumber((comp.width ?? 0.08) * SOURCE_X));
  const boundsH = Math.max(12, sourceNumber((comp.height ?? 0.08) * SOURCE_Y));
  // Detected bounds are in image axes. Work in local axes before rotation.
  const localW = horizontal ? boundsH : boundsW;
  const localH = horizontal ? boundsW : boundsH;
  const left = comp.pins.filter((p, i) => pinSide(p, i, comp.pins.length) === "left");
  const right = comp.pins.filter((p, i) => pinSide(p, i, comp.pins.length) === "right");
  const radians = orientation * Math.PI / 180;
  const rotate = (x: number, y: number): NetlistPoint => ({
    x: sourceNumber(center.x + x * Math.cos(radians) - y * Math.sin(radians)),
    y: sourceNumber(center.y + x * Math.sin(radians) + y * Math.cos(radians)),
  });
  const parts = [
    `R~${sourceNumber(center.x - boundsW / 2)}~${sourceNumber(center.y - boundsH / 2)}~~~${boundsW}~${boundsH}~#880000~1~0~none~gge${seed}~0~`,
    `T~N~${sourceNumber(center.x - boundsW / 2)}~${sourceNumber(center.y - boundsH / 2 - 12)}~0~#000080~~9pt~~~~~comment~${comp.id}~start~gge${seed + 1}~0~`,
  ];
  if (comp.value) parts.push(`T~N~${sourceNumber(center.x + boundsW / 2)}~${sourceNumber(center.y - boundsH / 2 - 12)}~0~#000080~~9pt~~~~~comment~${comp.value}~end~gge${seed + 2}~0~`);

  comp.pins.forEach((pin, index) => {
    const side = pinSide(pin, index, comp.pins.length);
    const group = side === "left" ? left : right;
    const row = group.indexOf(pin);
    const sign = side === "left" ? -1 : 1;
    const inferred = rotate(sign * (localW / 2 + 20), -localH / 2 + ((row + 1) * localH) / (group.length + 1));
    const tip = validPoint(pin.x === undefined || pin.y === undefined ? undefined : { x: pin.x, y: pin.y })
      ? sourcePoint({ x: pin.x as number, y: pin.y as number }) : inferred;
    // An explicit tip stays exact; draw the lead inward along its rotated side.
    const inner = {
      x: sourceNumber(tip.x - sign * 20 * Math.cos(radians)),
      y: sourceNumber(tip.y - sign * 20 * Math.sin(radians)),
    };
    const rot = (side === "left" ? orientation : (orientation + 180) % 360);
    const id = seed + 3 + index;
    parts.push([
      `P~show~0~${pin.number}~${tip.x}~${tip.y}~${rot}~gge${id}`,
      `^^${rot}~${tip.x}~${tip.y}`,
      `^^M ${inner.x} ${inner.y} L ${tip.x} ${tip.y}~#880000~1~0~none`,
      `^^1~${inner.x}~${inner.y}~0~${pin.name}~start~~~#0000FF`,
      `^^1~${tip.x}~${tip.y}~0~${pin.number}~end~~~#0000FF`,
      `^^0~M ${inner.x} ${inner.y} L ${tip.x} ${tip.y}~#880000~1~0`,
      `^^0~0~${inner.x}~${inner.y}~#880000~gge${id}_dot`,
    ].join(""));
    placed.push({ key: `${comp.id}.${pin.number}`, ...tip });
  });
  return `LIB~${center.x}~${center.y}~package\`\`nameDisplay\`\`spicePre\`${comp.id[0] ?? "U"}\`spiceSymbolName\`${comp.id}\`type\`${comp.type}~~~~gge${seed}~1~` + parts.join("#@$");
}

function hasUsableSourceGeometry(netlist: Netlist): boolean {
  return netlist.components.some((comp) =>
    validPoint(comp.x === undefined || comp.y === undefined ? undefined : { x: comp.x, y: comp.y }) ||
    comp.pins.some((pin) => validPoint(pin.x === undefined || pin.y === undefined ? undefined : { x: pin.x, y: pin.y })),
  ) || netlist.nets.some((net) =>
    (net.paths ?? []).some((path) => path.length > 1 && path.every(validPoint)) ||
    (net.junctions ?? []).some(validPoint) || validPoint(net.label),
  );
}

function sourceShapes(netlist: Netlist): string[] {
  const shapes: string[] = [];
  const placed: PlacedPin[] = [];
  let missing = 0;
  netlist.components.forEach((comp, index) => {
    const positioned = validPoint(comp.x === undefined || comp.y === undefined ? undefined : { x: comp.x, y: comp.y });
    // Only unlocated parts are arranged outside the photographed sheet.
    const item = positioned ? comp : { ...comp, x: 1.14 + missing++ * 0.2, y: 0.5 };
    shapes.push(sourceSymbolShape(item, 1000 + index * Math.max(50, comp.pins.length + 4), placed));
  });
  const find = (component: string, pin: string) => placed.find((item) => item.key === `${component}.${pin}`);
  let id = 5000;
  const wire = (points: NetlistPoint[]) => {
    if (points.length > 1 && points.some((point, i) => i > 0 && (point.x !== points[i - 1]?.x || point.y !== points[i - 1]?.y))) {
      shapes.push(`W~${points.map((point) => `${point.x} ${point.y}`).join(" ")}~#008800~1~0~none~gge${id++}~0`);
    }
  };
  netlist.nets.forEach((net) => {
    const pins = net.connections.map((connection) => find(connection.component, connection.pin)).filter((pin): pin is PlacedPin => Boolean(pin));
    const paths = (net.paths ?? []).filter((path) => path.length > 1 && path.every(validPoint));
    if (paths.length) {
      paths.forEach((path) => wire(path.map(sourcePoint)));
    } else if (pins.length > 1) {
      // Only incomplete/older nets need generated routing. Do not reroute a
      // detected path, even when its turns differ from the pin arrangement.
      const trunkX = sourceNumber(pins.reduce((sum, pin) => sum + pin.x, 0) / pins.length);
      const top = Math.min(...pins.map((pin) => pin.y));
      const bottom = Math.max(...pins.map((pin) => pin.y));
      wire([{ x: trunkX, y: top }, { x: trunkX, y: bottom }]);
      pins.forEach((pin) => wire([{ x: pin.x, y: pin.y }, { x: trunkX, y: pin.y }]));
    }
    (net.junctions ?? []).filter(validPoint).forEach((point) => {
      const mapped = sourcePoint(point);
      shapes.push(`J~${mapped.x}~${mapped.y}~2.5~#008800~gge${id++}~0~`);
    });
    const firstPoint = paths[0]?.[0];
    const label = validPoint(net.label) ? sourcePoint(net.label) : firstPoint ? sourcePoint(firstPoint) : pins[0];
    if (net.name && label) shapes.push(`N~${label.x}~${label.y}~0~#008800~${net.name}~start~~9pt~gge${id++}~0~${net.name}`);
  });
  return shapes;
}

export interface EasyEdaDoc {
  head: Record<string, string | number | boolean | null | Record<string, string>>;
  canvas: string;
  shape: string[];
  BBox: { x: number; y: number; width: number; height: number };
  colors: Record<string, string>;
  title: string;
}

const CELL_W = 320;
const CELL_H = 220;
const MARGIN_X = 140;
const MARGIN_Y = 120;

export function netlistToEasyEda(netlist: Netlist): EasyEdaDoc {
  const shapes: string[] = [];
  const placed: PlacedPin[] = [];
  const count = netlist.components.length || 1;
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(count))));

  const source = hasUsableSourceGeometry(netlist);

  // Keep the relative arrangement read from the image, but snap every part
  // into a clean grid cell so nothing overlaps.
  const ordered = source ? [] : netlist.components
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

  const rows = Math.ceil(ordered.length / cols);
  const cellOriginX = (col: number) => snap(MARGIN_X + col * CELL_W);
  const cellOriginY = (row: number) => snap(MARGIN_Y + row * CELL_H);

  ordered.forEach(({ comp }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    shapes.push(
      symbolShape(comp, cellOriginX(col), cellOriginY(row), 1000 + i * 50, placed),
    );
  });

  const find = (component: string, pin: string) =>
    placed.find((p) => p.key === `${component}.${pin}`);

  // Routing channels: one vertical corridor to the left of each column, plus
  // one to the right of the last column. Nets get their own lane in a channel
  // so trunks never sit on top of each other.
  const channelX: number[] = [];
  for (let c = 0; c <= cols; c += 1) channelX.push(snap(MARGIN_X + c * CELL_W - 70));
  const laneUsed = new Array(channelX.length).fill(0);

  let wireId = 5000;
  const wire = (points: string) => {
    shapes.push(`W~${points}~#008800~1~0~none~gge${wireId}~0`);
    wireId += 1;
  };

  if (!source) netlist.nets.forEach((net) => {
    const pts = net.connections
      .map((c) => find(c.component, c.pin))
      .filter((p): p is PlacedPin => Boolean(p));
    if (pts.length < 2) return;

    const meanX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    let ch = 0;
    channelX.forEach((cx, i) => {
      if (Math.abs(cx - meanX) < Math.abs((channelX[ch] as number) - meanX)) ch = i;
    });
    const lane = laneUsed[ch] as number;
    laneUsed[ch] = lane + 1;
    const trunkX = snap((channelX[ch] as number) + (lane % 5) * 10 - 20);

    const ys = pts.map((p) => p.y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    if (bottom > top) wire(`${trunkX} ${top} ${trunkX} ${bottom}`);

    pts.forEach((p) => {
      if (p.x !== trunkX) wire(`${p.x} ${p.y} ${trunkX} ${p.y}`);
      shapes.push(`J~${trunkX}~${p.y}~2.5~#008800~gge${wireId}~0~`);
      wireId += 1;
    });

    if (net.name) {
      shapes.push(
        `N~${trunkX}~${top - 8}~0~#008800~${net.name}~start~~9pt~gge${wireId}~0~${net.name}`,
      );
      wireId += 1;
    }
  });

  const missingCount = netlist.components.filter((comp) => !validPoint(comp.x === undefined || comp.y === undefined ? undefined : { x: comp.x, y: comp.y })).length;
  const sheetW = source ? SOURCE_MARGIN_X * 2 + SOURCE_X + missingCount * 240 : snap(MARGIN_X * 2 + cols * CELL_W);
  const sheetH = source ? SOURCE_MARGIN_Y * 2 + SOURCE_Y : snap(MARGIN_Y * 2 + rows * CELL_H);
  if (source) shapes.push(...sourceShapes(netlist));


  return {
    head: {
      docType: "1",
      editorVersion: "6.5.44",
      newgId: true,
      c_para: {
        "Prefix Start": "1",
        Contributor: "Lovable Schematic Importer",
      },
      hasIdFlag: true,
      x: "0",
      y: "0",
      importFlag: 0,
      transformList: "",
    },
    canvas: `CA~${sheetW}~${sheetH}~#FFFFFF~yes~#CCCCCC~10~${sheetW}~${sheetH}~line~1~pixel~5~0~0~0~5~45~yes~yes`,
    shape: shapes,
    BBox: { x: 0, y: 0, width: sheetW, height: sheetH },

    colors: {},
    title: netlist.title ?? "Imported schematic",
  };
}
