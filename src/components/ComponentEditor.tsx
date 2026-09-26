import { reviewMessage } from "@/lib/recognition";
import { useMemo, useRef, useState } from "react";
import { Grid3X3, Hand, Minus, MousePointer2, Plus, RotateCw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import type { Netlist, NetlistComponent } from "@/lib/easyeda";
import { SYMBOL_KINDS, symbolKind, type SymbolKind } from "@/lib/schematic-symbols";
import { SchematicSymbol } from "@/components/SchematicSymbol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartPicker } from "@/components/PartPicker";

interface Props { netlist: Netlist; onChange: (next: Netlist) => void }
type Point = { x: number; y: number };
type Tool = "select" | "pan";

const BOARD_W = 120;
const BOARD_H = 80;
const clamp = (value: number, max: number) => Math.min(max - 3, Math.max(3, value));
const snap = (value: number) => Math.round(value * 2) / 2;
const displayName = (kind: SymbolKind) => kind.replace("-ansi", "").replace("-iec", " IEC").replaceAll("-", " ");
const rotatePoint = (point: Point, angle: number): Point => {
  const radians = (angle * Math.PI) / 180;
  return { x: point.x * Math.cos(radians) - point.y * Math.sin(radians), y: point.x * Math.sin(radians) + point.y * Math.cos(radians) };
};

export function ComponentEditor({ netlist, onChange }: Props) {
  const boardRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(netlist.components[0]?.id ?? null);
  const [dragging, setDragging] = useState<{ id: string; origin: Point } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("select");
  const [panDrag, setPanDrag] = useState<{ x: number; y: number; pan: Point } | null>(null);

  const update = (id: string, patch: Partial<NetlistComponent>) => {
    onChange({
      ...netlist,
      components: netlist.components.map((component) => component.id === id ? { ...component, ...patch } : component),
      nets: patch.id && patch.id !== id ? netlist.nets.map((net) => ({ ...net, connections: net.connections.map((connection) => connection.component === id ? { ...connection, component: patch.id as string } : connection) })) : netlist.nets,
    });
    if (patch.id && patch.id !== id) setSelected(patch.id);
  };

  const positioned = useMemo(() => netlist.components.map((component, index) => {
    const x = (component.x ?? ((index % 4) + 0.5) / 4) * BOARD_W;
    const y = (component.y ?? (Math.floor(index / 4) + 0.5) / 3) * BOARD_H;
    const h = Math.max(component.height ? component.height * BOARD_H : 0, Math.max(10, Math.ceil(component.pins.length / 2) * 4 + 5));
    const w = Math.max(component.width ? component.width * BOARD_W : 0, symbolKind(component) === "ic" || symbolKind(component) === "relay" || symbolKind(component) === "connector" ? 12 : 14);
    return { component, x, y, h, w };
  }), [netlist.components]);

  const pinPoints = useMemo(() => {
    const points = new Map<string, Point>();
    positioned.forEach(({ component, x, y, h, w }) => {
      const left = component.pins.filter((pin, index) => pin.side === "left" || (!pin.side && index < Math.ceil(component.pins.length / 2)));
      const right = component.pins.filter((pin, index) => pin.side === "right" || (!pin.side && index >= Math.ceil(component.pins.length / 2)));
      component.pins.forEach((pin, index) => {
        if (typeof pin.x === "number" && typeof pin.y === "number") {
          points.set(`${component.id}.${pin.number}`, { x: pin.x * BOARD_W, y: pin.y * BOARD_H });
          return;
        }
        const side = pin.side ?? (index < Math.ceil(component.pins.length / 2) ? "left" : "right");
        const list = side === "left" ? left : right;
        const pinIndex = list.indexOf(pin);
        const local = rotatePoint({ x: side === "left" ? -w / 2 - 1 : w / 2 + 1, y: -h / 2 + ((pinIndex + 1) * h) / (list.length + 1) }, component.orientation ?? 0);
        points.set(`${component.id}.${pin.number}`, { x: x + local.x, y: y + local.y });
      });
    });
    return points;
  }, [positioned]);

  const fallbackPaths = (connections: { component: string; pin: string }[]) => {
    const points = connections.map((connection) => pinPoints.get(`${connection.component}.${connection.pin}`)).filter((point): point is Point => Boolean(point));
    if (points.length < 2) return [];
    const trunkX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    return points.map((point) => [point, { x: trunkX, y: point.y }]).concat([[{ x: trunkX, y: Math.min(...points.map((p) => p.y)) }, { x: trunkX, y: Math.max(...points.map((p) => p.y)) }]]);
  };

  const toLocal = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!boardRef.current) return null;
    const point = boardRef.current.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const matrix = boardRef.current.getScreenCTM()?.inverse();
    return matrix ? point.matrixTransform(matrix) : null;
  };

  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panDrag) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPan({ x: panDrag.pan.x - ((event.clientX - panDrag.x) / rect.width) * (BOARD_W / zoom), y: panDrag.pan.y - ((event.clientY - panDrag.y) / rect.height) * (BOARD_H / zoom) });
      return;
    }
    if (!dragging) return;
    const local = toLocal(event);
    if (!local) return;
    const x = snap(clamp(local.x, BOARD_W));
    const y = snap(clamp(local.y, BOARD_H));
    const dx = (x - dragging.origin.x) / BOARD_W;
    const dy = (y - dragging.origin.y) / BOARD_H;
    const moved = netlist.components.find((component) => component.id === dragging.id);
    const oldAnchors = new Map(
      (moved?.pins ?? [])
        .filter((pin) => typeof pin.x === "number" && typeof pin.y === "number")
        .map((pin) => [pin.number, { x: pin.x as number, y: pin.y as number }]),
    );
    onChange({
      ...netlist,
      components: netlist.components.map((component) => component.id === dragging.id ? {
        ...component, x: x / BOARD_W, y: y / BOARD_H,
        pins: component.pins.map((pin) => typeof pin.x === "number" && typeof pin.y === "number" ? { ...pin, x: pin.x + dx, y: pin.y + dy } : pin),
      } : component),
      nets: netlist.nets.map((net) => {
        if (!net.paths || !net.connections.some((connection) => connection.component === dragging.id)) return net;
        const connectedAnchors = net.connections
          .filter((connection) => connection.component === dragging.id)
          .map((connection) => oldAnchors.get(connection.pin))
          .filter((point): point is Point => Boolean(point));
        return {
          ...net,
          paths: net.paths.map((path) => path.map((point) =>
            connectedAnchors.some((anchor) => Math.abs(anchor.x - point.x) < 0.002 && Math.abs(anchor.y - point.y) < 0.002)
              ? { x: point.x + dx, y: point.y + dy }
              : point,
          )),
        };
      }),
    });
    setDragging({ id: dragging.id, origin: { x, y } });
  };

  const removeComponent = (id: string) => {
    onChange({ ...netlist, components: netlist.components.filter((component) => component.id !== id), nets: netlist.nets.map((net) => ({ ...net, connections: net.connections.filter((connection) => connection.component !== id) })) });
    setSelected(null);
  };

  const addComponent = (kind: SymbolKind = "generic") => {
    let index = 1;
    while (netlist.components.some((component) => component.id === `U${index}`)) index += 1;
    const id = `U${index}`;
    onChange({ ...netlist, components: [...netlist.components, { id, type: kind, symbolKind: kind, x: 0.5, y: 0.5, pins: [{ number: "1", name: "1", side: "left" }, { number: "2", name: "2", side: "right" }] }] });
    setSelected(id);
  };

  const active = netlist.components.find((component) => component.id === selected) ?? null;

  // Fit the view to whatever was actually drawn, so the sheet is never a mostly
  // empty page with a tiny cluster of parts in the middle.
  const bounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    positioned.forEach(({ x, y, w, h }) => {
      xs.push(x - w / 2 - 3, x + w / 2 + 3);
      ys.push(y - h / 2 - 4, y + h / 2 + 5);
    });
    pinPoints.forEach((point) => { xs.push(point.x); ys.push(point.y); });
    netlist.nets.forEach((net) => (net.paths ?? []).forEach((path) => path.forEach((point) => { xs.push(point.x * BOARD_W); ys.push(point.y * BOARD_H); })));
    if (!xs.length) return { x: 0, y: 0, w: BOARD_W, h: BOARD_H };
    const minX = Math.min(...xs) - 4;
    const minY = Math.min(...ys) - 4;
    return { x: minX, y: minY, w: Math.max(20, Math.max(...xs) + 4 - minX), h: Math.max(16, Math.max(...ys) + 4 - minY) };
  }, [positioned, pinPoints, netlist.nets]);

  const spanW = bounds.w / zoom;
  const spanH = bounds.h / zoom;
  const viewStartX = bounds.x + (bounds.w - spanW) / 2 + pan.x;
  const viewStartY = bounds.y + (bounds.h - spanH) / 2 + pan.y;

  const palette = SYMBOL_KINDS.filter((kind) => !["generic", "resistor-iec"].includes(kind)).slice(0, 14);

  return (
    <div className="overflow-hidden rounded-md border border-schematic-border bg-schematic-canvas shadow-lg">
      <div className="flex min-h-11 items-center justify-between border-b border-schematic-border bg-editor-toolbar px-2 text-schematic-ink">
        <div className="flex items-center gap-1">
          <Button size="icon" variant={tool === "select" ? "secondary" : "ghost"} title="Select" aria-label="Select" onClick={() => setTool("select")}><MousePointer2 /></Button>
          <Button size="icon" variant={tool === "pan" ? "secondary" : "ghost"} title="Pan canvas" aria-label="Pan canvas" onClick={() => setTool("pan")}><Hand /></Button>
          <span className="mx-1 h-6 w-px bg-schematic-border" />
          <Button size="icon" variant="ghost" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}><ZoomOut /></Button>
          <span className="w-10 text-center font-mono text-[10px]">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><ZoomIn /></Button>
          <span className="mx-1 h-6 w-px bg-schematic-border md:hidden" />
          <Button size="icon" variant="ghost" className="md:hidden" title="Add component" aria-label="Add component" onClick={() => addComponent()}><Plus /></Button>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[10px] text-muted-foreground sm:flex"><Grid3X3 className="size-3" /> 0.5 grid</div>
      </div>

      {netlist.components.some((component) => reviewMessage(component)) && (
        <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="status">
          <strong>Check uncertain components:</strong>{" "}
          {netlist.components.filter((component) => reviewMessage(component)).map((component) => (
            <button key={component.id} type="button" className="mr-2 underline" title={reviewMessage(component) ?? ""} onClick={() => setSelected(component.id)}>{component.id}</button>
          ))}
          Select a component to see the reason and correct its properties.
        </div>
      )}
      <div className="grid min-h-[34rem] grid-cols-1 md:grid-cols-[10rem_minmax(0,1fr)_15rem]">
        <aside className="hidden border-r border-schematic-border bg-editor-toolbar md:block">
          <div className="border-b border-schematic-border px-3 py-2 font-mono text-[10px] font-semibold uppercase text-schematic-ink">Libraries</div>
          <div className="grid grid-cols-2 gap-px bg-schematic-border p-px">
            {palette.map((kind) => {
              const sample: NetlistComponent = { id: "", type: kind, symbolKind: kind, pins: [] };
              return <button key={kind} type="button" title={`Add ${displayName(kind)}`} onClick={() => addComponent(kind)} className="flex h-16 flex-col items-center justify-center gap-1 bg-editor-toolbar text-schematic-ink hover:bg-schematic-selection"><svg viewBox="-10 -8 20 16" className="h-7 w-10"><SchematicSymbol component={sample} height={10} /></svg><span className="max-w-full truncate px-1 text-[9px] capitalize">{displayName(kind)}</span></button>;
            })}
          </div>
        </aside>

        <div className="relative min-w-0 bg-schematic-grid">
          <svg ref={boardRef} viewBox={`${viewStartX} ${viewStartY} ${spanW} ${spanH}`} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.min(3, Math.max(0.75, value + (event.deltaY < 0 ? 0.1 : -0.1)))); }} onPointerDown={(event) => { if (event.target !== event.currentTarget && tool !== "pan") return; event.currentTarget.setPointerCapture(event.pointerId); setPanDrag({ x: event.clientX, y: event.clientY, pan }); }} onPointerMove={move} onPointerUp={() => { setDragging(null); setPanDrag(null); }} onPointerLeave={() => { setDragging(null); setPanDrag(null); }} className="block h-[34rem] w-full touch-none" aria-label="Schematic editor canvas">
            {netlist.nets.flatMap((net, netIndex) => {
              const paths = net.paths?.length ? net.paths.map((path) => path.map((point) => ({ x: point.x * BOARD_W, y: point.y * BOARD_H }))) : fallbackPaths(net.connections);
              // Label sits on the net it names; never stacked in the sheet corner.
              const anchor = net.label ? { x: net.label.x * BOARD_W, y: net.label.y * BOARD_H } : paths[0]?.[0];
              return [
                ...paths.map((path, pathIndex) => <polyline key={`${netIndex}-path-${pathIndex}`} points={path.map((point) => `${point.x},${point.y}`).join(" ")} className="fill-none stroke-schematic-wire" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />),
                ...(net.junctions ?? []).map((point, index) => <circle key={`${netIndex}-junction-${index}`} cx={point.x * BOARD_W} cy={point.y * BOARD_H} r="0.7" className="fill-schematic-wire" />),
                ...(anchor ? [<text key={`${netIndex}-label`} x={anchor.x} y={anchor.y - 1} className="fill-schematic-wire font-mono" fontSize="1.6">{net.name}</text>] : []),
              ];
            })}

            {positioned.map(({ component, x, y, h, w }) => {
              const isActive = component.id === selected;
              return <g key={component.id} className={tool === "select" ? "cursor-crosshair" : "cursor-grab"} onPointerDown={(event) => { if (tool !== "select") return; event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); setDragging({ id: component.id, origin: { x, y } }); setSelected(component.id); }}>
                {isActive && <rect x={x - w / 2 - 2} y={y - h / 2 - 3} width={w + 4} height={h + 6} className="fill-schematic-selection stroke-schematic-wire" strokeDasharray="1 1" strokeWidth="0.35" />}
                <g transform={`translate(${x} ${y}) rotate(${component.orientation ?? 0})`}><SchematicSymbol component={component} height={h} active={isActive} /></g>
                <text x={x} y={y - Math.max(7, h / 2 + 1.5)} textAnchor="middle" className="fill-schematic-component font-mono" fontSize="2">{component.id}</text>
                <text x={x} y={y + Math.max(8, h / 2 + 2.5)} textAnchor="middle" className="fill-schematic-ink font-mono" fontSize="1.35">{component.value ?? component.part ?? component.type}</text>
                {component.pins.map((pin) => { const point = pinPoints.get(`${component.id}.${pin.number}`); return point ? <g key={pin.number}><circle cx={point.x} cy={point.y} r="0.42" className="fill-schematic-wire"/><text x={point.x + 0.7} y={point.y - 0.6} className="fill-schematic-ink font-mono" fontSize="1.15">{pin.number}</text></g> : null; })}
              </g>;
            })}
          </svg>
        </div>

        <aside className="border-t border-schematic-border bg-editor-toolbar md:border-l md:border-t-0">
          <div className="border-b border-schematic-border px-3 py-2 font-mono text-[10px] font-semibold uppercase text-schematic-ink">Properties</div>
          {active ? <div className="space-y-3 p-3">
            {reviewMessage(active) && <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">{reviewMessage(active)}</p>}
            {active.confidence !== undefined && <p className="text-xs text-muted-foreground">Reading confidence: {Math.round(active.confidence * 100)}% (estimate)</p>}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1"><Input value={active.id} onChange={(event) => update(active.id, { id: event.target.value })} className="font-mono text-xs" placeholder="Designator"/><Input value={active.value ?? ""} onChange={(event) => update(active.id, { value: event.target.value })} className="font-mono text-xs" placeholder="Value"/></div>
            <label className="block text-[10px] uppercase text-muted-foreground">Symbol<select value={symbolKind(active)} onChange={(event) => update(active.id, { symbolKind: event.target.value as SymbolKind, type: event.target.value })} className="mt-1 h-9 w-full rounded border border-input bg-schematic-canvas px-2 text-xs text-schematic-ink">{SYMBOL_KINDS.map((kind) => <option key={kind} value={kind}>{displayName(kind)}</option>)}</select></label>
            <div className="space-y-1">{active.pins.map((pin, index) => <div key={`${pin.number}-${index}`} className="flex gap-1"><Input value={pin.number} onChange={(event) => update(active.id, { pins: active.pins.map((item, itemIndex) => itemIndex === index ? { ...item, number: event.target.value } : item) })} className="w-12 font-mono text-xs"/><Input value={pin.name} onChange={(event) => update(active.id, { pins: active.pins.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} className="min-w-0 flex-1 font-mono text-xs"/><Button size="icon" variant="ghost" title="Remove pin" aria-label="Remove pin" onClick={() => update(active.id, { pins: active.pins.filter((_, itemIndex) => itemIndex !== index) })}><Minus /></Button></div>)}</div>
            <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => update(active.id, { orientation: (((active.orientation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270 })}><RotateCw /> {active.orientation ?? 0}°</Button><Button size="icon" variant="outline" title="Add pin" aria-label="Add pin" onClick={() => update(active.id, { pins: [...active.pins, { number: String(active.pins.length + 1), name: String(active.pins.length + 1), side: "left" }] })}><Plus /></Button><Button size="icon" variant="ghost" title="Delete part" aria-label="Delete part" className="text-destructive" onClick={() => removeComponent(active.id)}><Trash2 /></Button></div>
            <PartPicker component={active} onApply={(patch) => update(active.id, patch)} />
          </div> : <p className="p-3 text-xs text-muted-foreground">Select a component to edit its properties.</p>}
        </aside>
      </div>
      <div className="flex h-7 items-center justify-between border-t border-schematic-border bg-editor-chrome px-3 font-mono text-[10px] text-primary-foreground"><span>{tool === "pan" ? "Pan: drag canvas" : "Select: drag component"}</span><span>{netlist.components.length} parts · {netlist.nets.length} nets</span></div>
    </div>
  );
}

