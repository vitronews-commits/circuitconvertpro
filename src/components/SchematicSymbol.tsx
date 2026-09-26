import type { NetlistComponent } from "@/lib/easyeda";
import { symbolKind } from "@/lib/schematic-symbols";

interface Props {
  component: NetlistComponent;
  height?: number;
  active?: boolean;
  className?: string;
}

export function SchematicSymbol({ component, height = 12, active = false, className = "" }: Props) {
  const kind = symbolKind(component);
  const common = { className: `fill-none stroke-schematic-component ${className}`, strokeWidth: active ? 0.8 : 0.52, vectorEffect: "non-scaling-stroke" as const, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "resistor-ansi") return <path d="M-7 0H-5L-4-2.4-2 2.4 0-2.4 2 2.4 4-2.4 5 0H7" {...common} />;
  if (kind === "resistor-iec") return <g {...common}><path d="M-7 0h2M5 0h2"/><rect x="-5" y="-2" width="10" height="4"/></g>;
  if (kind === "capacitor" || kind === "capacitor-polarized") return <g {...common}><path d="M-7 0h5M-2-4v8M2-4v8M2 0h5"/>{kind === "capacitor-polarized" && <><path d="M-5-4h2M-4-5v2"/><path d="M2-4q2 4 0 8"/></>}</g>;
  if (kind === "inductor") return <path d="M-7 0h2c0-3 2.5-3 2.5 0 0-3 2.5-3 2.5 0 0-3 2.5-3 2.5 0 0-3 2.5-3 2.5 0h2" {...common} />;
  if (["diode", "led", "zener", "schottky"].includes(kind)) return <g {...common}><path d="M-7 0h4M3 0h4M-3-3 3 0-3 3Z"/><path d={kind === "zener" ? "M2-4l1 1v6l1 1" : kind === "schottky" ? "M2-4v2h1v4H2v2" : "M3-4v8"}/>{kind === "led" && <><path d="m1-4 3-3m-1 0h1v1M3-2l3-3m-1 0h1v1"/></>}</g>;
  if (kind === "switch") return <g {...common}><path d="M-7 0h4M3 0h4M-3 0l5-4"/><circle cx="-3" cy="0" r="0.7"/><circle cx="3" cy="0" r="0.7"/></g>;
  if (kind === "crystal") return <g {...common}><path d="M-7 0h3M-4-3v6M-2-4h4v8h-4M4-3v6M4 0h3"/></g>;
  if (kind === "opamp") return <g {...common}><path d="M-5-5v10L5 0Z"/><path d="M-7-2h2M-7 2h2M5 0h2"/><path d="M-4-2h1M-3.5-2.5v1M-4 2h1"/></g>;
  if (kind === "bjt-npn" || kind === "bjt-pnp") return <g {...common}><circle r="5"/><path d="M-7 0h3M-4-3v6M-4-2l4-2v-3M-4 2l4 2v3"/><path d={kind === "bjt-npn" ? "M-1.8 3.1 0 4-1.6 4.7" : "M-4 2-2.2 2.1-3.1 3.6"}/></g>;
  if (kind === "nmos" || kind === "pmos") return <g {...common}><circle r="5"/><path d="M-7 0h3M-3-3v6M-1-3v2M-1 0v1M-1 2v1M-1-2h2v-5M-1 2h2v5"/>{kind === "pmos" && <circle cx="-3.4" cy="0" r="0.8"/>}</g>;
  if (kind === "relay") return <g {...common}><rect x="-5" y={-height / 2} width="10" height={height}/><path d="M-4 3c1-3 2 3 3 0s2 3 3 0M1-3l3-2M4-5v-2"/></g>;
  if (kind === "ground") return <g {...common}><path d="M0-6v6M-4 0h8M-2.8 2h5.6M-1.3 4h2.6"/></g>;
  if (kind === "power") return <g {...common}><path d="M0 6V-3M-3 0l3-3 3 3"/></g>;
  if (kind === "connector") return <g {...common}><rect x="-4" y={-height / 2} width="8" height={height}/><path d={`M-1 ${-height / 2}V${height / 2}`}/></g>;
  return <rect x="-6" y={-height / 2} width="12" height={height} rx="0.4" className={active ? "fill-schematic-selection stroke-schematic-component" : "fill-schematic-canvas stroke-schematic-component"} strokeWidth={active ? 0.8 : 0.52} vectorEffect="non-scaling-stroke"/>;
}
