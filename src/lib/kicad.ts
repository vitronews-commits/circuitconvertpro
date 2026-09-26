// Builds a KiCad 6/7/8 schematic (.kicad_sch, S-expressions) from the netlist.

import type { Netlist } from "./easyeda";
import { layoutNetlist, stableUuid, STEP_MM, type LaidComponent } from "./layout";
import { symbolKind } from "./schematic-symbols";

const mm = (steps: number) => Number((steps * STEP_MM).toFixed(2));
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const sym = (s: string) => (s || "PART").replace(/[^A-Za-z0-9_.+-]/g, "_");

function libSymbol(lc: LaidComponent): string {
  const name = sym(lc.comp.id);
  const ref = (lc.comp.id.match(/^[A-Za-z]+/)?.[0] ?? "U").toUpperCase();
  const halfW = mm(lc.w) / 2;
  const halfH = mm(lc.h) / 2;
  const kind = symbolKind(lc.comp);
  const body = kind.startsWith("resistor")
    ? `(polyline (pts (xy ${-halfW} 0) (xy ${-halfW * 0.65} 0) (xy ${-halfW * 0.45} ${halfH * 0.55}) (xy ${-halfW * 0.15} ${-halfH * 0.55}) (xy ${halfW * 0.15} ${halfH * 0.55}) (xy ${halfW * 0.45} ${-halfH * 0.55}) (xy ${halfW * 0.65} 0) (xy ${halfW} 0)) (stroke (width 0.254) (type default)) (fill (type none)))`
    : kind.includes("capacitor")
      ? `(polyline (pts (xy ${-halfW} 0) (xy -1.27 0)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy -1.27 ${halfH * 0.65}) (xy -1.27 ${-halfH * 0.65})) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 ${halfH * 0.65}) (xy 1.27 ${-halfH * 0.65})) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 0) (xy ${halfW} 0)) (stroke (width 0.254) (type default)) (fill (type none)))`
      : kind === "diode" || kind === "led" || kind === "zener" || kind === "schottky"
        ? `(polyline (pts (xy ${-halfW} 0) (xy ${-halfW * 0.45} 0) (xy ${halfW * 0.35} ${halfH * 0.55}) (xy ${halfW * 0.35} ${-halfH * 0.55}) (xy ${-halfW * 0.45} 0)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy ${halfW * 0.35} ${halfH * 0.65}) (xy ${halfW * 0.35} ${-halfH * 0.65})) (stroke (width 0.254) (type default)) (fill (type none)))`
        : `(rectangle (start ${-halfW} ${halfH}) (end ${halfW} ${-halfH}) (stroke (width 0.254) (type default)) (fill (type background)))`;

  const pins = lc.pins
    .map((p) => {
      // local coordinates, origin at body centre, Y up
      const px = p.side === "left" ? -(halfW + mm(2)) : halfW + mm(2);
      const py = Number((halfH - mm(p.ly)).toFixed(2));
      const rot = p.side === "left" ? 0 : 180;
      return `      (pin passive line (at ${px} ${py} ${rot}) (length ${mm(2)})
        (name "${esc(p.name || p.number)}" (effects (font (size 1.27 1.27))))
        (number "${esc(p.number)}" (effects (font (size 1.27 1.27))))
      )`;
    })
    .join("\n");

  return `    (symbol "lovable:${name}" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)
      (property "Reference" "${ref}" (at 0 ${halfH + 2.54} 0) (effects (font (size 1.27 1.27))))
      (property "Value" "${esc(lc.comp.part || lc.comp.value || lc.comp.type)}" (at 0 ${-(halfH + 2.54)} 0) (effects (font (size 1.27 1.27))))
      (property "Footprint" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (property "Datasheet" "${esc(lc.comp.datasheet ?? "")}" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (symbol "${name}_0_1"
        ${body}
      )
      (symbol "${name}_1_1"
${pins}
      )
    )`;
}

function instance(lc: LaidComponent): string {
  const name = sym(lc.comp.id);
  const cx = mm(lc.x + lc.w / 2);
  const cy = mm(lc.y + lc.h / 2);
  const uuid = stableUuid(`sym:${lc.comp.id}`);
  const pinLines = lc.pins
    .map((p) => `    (pin "${esc(p.number)}" (uuid ${stableUuid(`pin:${lc.comp.id}:${p.number}`)}))`)
    .join("\n");
  return `  (symbol (lib_id "lovable:${name}") (at ${cx} ${cy} ${lc.comp.orientation ?? 0}) (unit 1)
    (in_bom yes) (on_board yes) (dnp no) (uuid ${uuid})
    (property "Reference" "${esc(lc.comp.id)}" (at ${cx} ${Number((cy - mm(lc.h / 2) - 2.54).toFixed(2))} 0) (effects (font (size 1.27 1.27))))
    (property "Value" "${esc(lc.comp.value || lc.comp.part || lc.comp.type)}" (at ${cx} ${Number((cy + mm(lc.h / 2) + 2.54).toFixed(2))} 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at ${cx} ${cy} 0) (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "${esc(lc.comp.datasheet ?? "")}" (at ${cx} ${cy} 0) (effects (font (size 1.27 1.27)) hide))
    (property "LCSC" "${esc(lc.comp.lcsc ?? "")}" (at ${cx} ${cy} 0) (effects (font (size 1.27 1.27)) hide))
${pinLines}
  )`;
}

export function netlistToKicad(netlist: Netlist): string {
  const layout = layoutNetlist(netlist);
  const out: string[] = [];

  out.push(`(kicad_sch (version 20230121) (generator lovable_schematic_importer)`);
  out.push(`  (uuid ${stableUuid(`sheet:${netlist.title ?? "schematic"}`)})`);
  out.push(`  (paper "A3")`);
  out.push(`  (title_block (title "${esc(netlist.title ?? "Imported schematic")}") (company "Imported from image"))`);
  out.push(`  (lib_symbols`);
  layout.components.forEach((lc) => out.push(libSymbol(lc)));
  out.push(`  )`);

  layout.nets.forEach((net, ni) => {
    net.segments.forEach((s, si) => {
      out.push(`  (wire (pts (xy ${mm(s.x1)} ${mm(s.y1)}) (xy ${mm(s.x2)} ${mm(s.y2)}))
    (stroke (width 0) (type default)) (uuid ${stableUuid(`wire:${net.name}:${ni}:${si}`)})
  )`);
    });
    net.junctions.forEach((j, ji) => {
      out.push(
        `  (junction (at ${mm(j.x)} ${mm(j.y)}) (diameter 0) (color 0 0 0 0) (uuid ${stableUuid(`junction:${net.name}:${ji}`)}))`,
      );
    });
    if (net.name) {
      out.push(`  (label "${esc(net.name)}" (at ${mm(net.label.x)} ${mm(net.label.y)} 0)
    (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid ${stableUuid(`label:${net.name}:${ni}`)})
  )`);
    }
  });

  layout.components.forEach((lc) => out.push(instance(lc)));

  out.push(`  (sheet_instances (path "/" (page "1")))`);
  out.push(`)`);
  return out.join("\n") + "\n";
}

