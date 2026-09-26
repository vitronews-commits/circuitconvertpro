import { layoutNetlist } from "@/lib/layout";
import type { Netlist } from "@/lib/easyeda";
import { SchematicSymbol } from "@/components/SchematicSymbol";

interface Props {
  netlist: Netlist;
  format: "kicad" | "eagle";
}

export function SchematicPreview({ netlist, format }: Props) {
  const layout = layoutNetlist(netlist);
  const padding = 3;
  const viewBox = `${-padding} ${-padding} ${layout.width + padding * 2} ${layout.height + padding * 2}`;

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-schematic-border bg-schematic-canvas">
      <div className="flex items-center justify-between border-b border-schematic-border px-3 py-2">
        <span className="font-mono text-[11px] text-schematic-ink">
          {format === "kicad" ? "KiCad sheet preview" : "EAGLE sheet preview"}
        </span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          {layout.components.length} parts · {layout.nets.length} nets
        </span>
      </div>
      <svg
        role="img"
        aria-label={`${format === "kicad" ? "KiCad" : "EAGLE"} schematic preview`}
        viewBox={viewBox}
        className="block h-64 w-full bg-schematic-grid"
      >
        {layout.nets.flatMap((net, netIndex) =>
          net.segments.map((segment, segmentIndex) => (
            <line
              key={`${netIndex}-${segmentIndex}`}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              className="stroke-schematic-wire"
              strokeWidth="0.42"
              vectorEffect="non-scaling-stroke"
            />
          )),
        )}
        {layout.nets.flatMap((net, netIndex) =>
          net.junctions.map((junction, junctionIndex) => (
            <circle
              key={`${netIndex}-${junctionIndex}`}
              cx={junction.x}
              cy={junction.y}
              r="0.55"
              className="fill-schematic-wire"
            />
          )),
        )}
        {layout.components.map((component) => (
          <g key={component.comp.id}>
            <g transform={`translate(${component.x + component.w / 2} ${component.y + component.h / 2}) rotate(${component.comp.orientation ?? 0}) scale(${Math.max(0.5, component.w / 14)})`}>
              <SchematicSymbol component={component.comp} height={component.h / Math.max(0.5, component.w / 14)} />
            </g>
            <text
              x={component.x}
              y={component.y - 0.8}
              className="fill-schematic-component font-mono"
              fontSize="1.5"
            >
              {component.comp.id}
            </text>
            <text
              x={component.x + component.w}
              y={component.y - 0.8}
              textAnchor="end"
              className="fill-schematic-ink font-mono"
              fontSize="1.1"
            >
              {component.comp.value ?? component.comp.type}
            </text>
            {component.pins.map((pin) => (
              <g key={pin.number}>
                <line
                  x1={pin.side === "left" ? component.x : component.x + component.w}
                  y1={pin.y}
                  x2={pin.x}
                  y2={pin.y}
                  className="stroke-schematic-component"
                  strokeWidth="0.35"
                />
                <text
                  x={pin.side === "left" ? component.x + 0.5 : component.x + component.w - 0.5}
                  y={pin.y + 0.4}
                  textAnchor={pin.side === "left" ? "start" : "end"}
                  className="fill-schematic-ink font-mono"
                  fontSize="0.9"
                >
                  {pin.number}
                </text>
              </g>
            ))}
          </g>
        ))}
        {layout.nets.map((net, index) => (
          <text
            key={`${net.name}-${index}`}
            x={net.label.x + 0.5}
            y={net.label.y}
            className="fill-schematic-wire font-mono"
            fontSize="1.15"
          >
            {net.name}
          </text>
        ))}
      </svg>
    </div>
  );
}
