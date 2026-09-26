// Builds an Autodesk EAGLE schematic (.sch, XML) from the netlist.

import type { Netlist } from "./easyeda";
import { layoutNetlist, STEP_MM, type LaidComponent } from "./layout";
import { symbolKind } from "./schematic-symbols";

const mm = (steps: number) => Number((steps * STEP_MM).toFixed(2));
const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const id = (s: string) => (s || "PART").replace(/[^A-Za-z0-9_.+-]/g, "_");

/** EAGLE references pins by name, so names must be unique inside a symbol. */
export function eaglePinNames(lc: LaidComponent): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  lc.pins.forEach((p) => {
    let base = id(p.name || p.number).toUpperCase();
    if (!base) base = `P${p.number}`;
    let name = base;
    let n = 2;
    while (used.has(name)) {
      name = `${base}_${n}`;
      n += 1;
    }
    used.add(name);
    map.set(p.number, name);
  });
  return map;
}

const LAYERS = [
  [91, "Nets", 2],
  [92, "Busses", 1],
  [93, "Pins", 2],
  [94, "Symbols", 4],
  [95, "Names", 7],
  [96, "Values", 7],
  [97, "Info", 7],
  [98, "Guide", 6],
] as const;

export function netlistToEagle(netlist: Netlist): string {
  const layout = layoutNetlist(netlist);
  const H = layout.height;
  const ey = (steps: number) => mm(H - steps);

  const symbols: string[] = [];
  const packages: string[] = [];
  const devicesets: string[] = [];
  const parts: string[] = [];
  const instances: string[] = [];
  const usedLibraryNames = new Set<string>();
  const uniqueLibraryName = (raw: string) => {
    const base = id(raw).toUpperCase();
    let candidate = base;
    let suffix = 2;
    while (usedLibraryNames.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    usedLibraryNames.add(candidate);
    return candidate;
  };

  layout.components.forEach((lc) => {
    const name = uniqueLibraryName(lc.comp.id);
    const names = eaglePinNames(lc);
    const halfW = mm(lc.w) / 2;
    const halfH = mm(lc.h) / 2;
    const kind = symbolKind(lc.comp);
    const bodyTags = kind.startsWith("resistor")
      ? `<wire x1="${-halfW}" y1="0" x2="${-halfW * 0.6}" y2="0" width="0.254" layer="94"/><wire x1="${-halfW * 0.6}" y1="0" x2="${-halfW * 0.4}" y2="${halfH * 0.55}" width="0.254" layer="94"/><wire x1="${-halfW * 0.4}" y1="${halfH * 0.55}" x2="0" y2="${-halfH * 0.55}" width="0.254" layer="94"/><wire x1="0" y1="${-halfH * 0.55}" x2="${halfW * 0.4}" y2="${halfH * 0.55}" width="0.254" layer="94"/><wire x1="${halfW * 0.4}" y1="${halfH * 0.55}" x2="${halfW * 0.6}" y2="0" width="0.254" layer="94"/><wire x1="${halfW * 0.6}" y1="0" x2="${halfW}" y2="0" width="0.254" layer="94"/>`
      : kind.includes("capacitor")
        ? `<wire x1="${-halfW}" y1="0" x2="-1.27" y2="0" width="0.254" layer="94"/><wire x1="-1.27" y1="${halfH * 0.65}" x2="-1.27" y2="${-halfH * 0.65}" width="0.254" layer="94"/><wire x1="1.27" y1="${halfH * 0.65}" x2="1.27" y2="${-halfH * 0.65}" width="0.254" layer="94"/><wire x1="1.27" y1="0" x2="${halfW}" y2="0" width="0.254" layer="94"/>`
        : `<wire x1="${-halfW}" y1="${halfH}" x2="${halfW}" y2="${halfH}" width="0.254" layer="94"/><wire x1="${halfW}" y1="${halfH}" x2="${halfW}" y2="${-halfH}" width="0.254" layer="94"/><wire x1="${halfW}" y1="${-halfH}" x2="${-halfW}" y2="${-halfH}" width="0.254" layer="94"/><wire x1="${-halfW}" y1="${-halfH}" x2="${-halfW}" y2="${halfH}" width="0.254" layer="94"/>`;

    const pinTags = lc.pins
      .map((p) => {
        const px = p.side === "left" ? -(halfW + mm(2)) : halfW + mm(2);
        const py = Number((halfH - mm(p.ly)).toFixed(2));
        const rot = p.side === "left" ? "R0" : "R180";
        return `<pin name="${xml(names.get(p.number) ?? p.number)}" x="${px}" y="${py}" length="short" rot="${rot}"/>`;
      })
      .join("");

    const padTags = lc.pins
      .map(
        (p, index) =>
          `<pad name="${xml(id(p.number))}" x="${mm(index * 2)}" y="0" drill="0.8" diameter="1.6"/>`,
      )
      .join("");
    packages.push(`<package name="${xml(name)}_PKG">${padTags}</package>`);

    symbols.push(
      `<symbol name="${xml(name)}_SYM">` +
        bodyTags +
        `<text x="${-halfW}" y="${halfH + 1.27}" size="1.778" layer="95">&gt;NAME</text>` +
        `<text x="${-halfW}" y="${-halfH - 3.05}" size="1.778" layer="96">&gt;VALUE</text>` +
        pinTags +
        `</symbol>`,
    );

    devicesets.push(
      `<deviceset name="${xml(name)}_DEV" prefix="${xml((lc.comp.id.match(/^[A-Za-z]+/)?.[0] ?? "U").toUpperCase())}">` +
        `<description>${xml(lc.comp.part ?? lc.comp.type)}</description>` +
        `<gates><gate name="G$1" symbol="${xml(name)}_SYM" x="0" y="0"/></gates>` +
        `<devices><device name="" package="${xml(name)}_PKG">` +
        `<connects>${lc.pins
          .map(
            (p) =>
              `<connect gate="G$1" pin="${xml(names.get(p.number) ?? p.number)}" pad="${xml(id(p.number))}"/>`,
          )
          .join("")}</connects>` +
        `<technologies><technology name=""/></technologies></device></devices>` +
        `</deviceset>`,
    );

    parts.push(
      `<part name="${xml(lc.comp.id)}" library="lovable" deviceset="${xml(name)}_DEV" device="" value="${xml(lc.comp.value || lc.comp.part || lc.comp.type)}"/>`,
    );

    instances.push(
      `<instance part="${xml(lc.comp.id)}" gate="G$1" x="${mm(lc.x + lc.w / 2)}" y="${ey(lc.y + lc.h / 2)}" rot="R${lc.comp.orientation ?? 0}"/>`,
    );
  });

  const pinNameFor = (component: string, pin: string) => {
    const lc = layout.components.find((c) => c.comp.id === component);
    if (!lc) return pin;
    return eaglePinNames(lc).get(pin) ?? pin;
  };

  const nets = layout.nets
    .map((net) => {
      const refs = net.pins
        .map(
          (p) =>
            `<pinref part="${xml(p.component)}" gate="G$1" pin="${xml(pinNameFor(p.component, p.number))}"/>`,
        )
        .join("");
      const wires = net.segments
        .map(
          (s) =>
            `<wire x1="${mm(s.x1)}" y1="${ey(s.y1)}" x2="${mm(s.x2)}" y2="${ey(s.y2)}" width="0.1524" layer="91"/>`,
        )
        .join("");
      const junctions = net.junctions
        .map((j) => `<junction x="${mm(j.x)}" y="${ey(j.y)}"/>`)
        .join("");
      const label = `<label x="${mm(net.label.x)}" y="${ey(net.label.y)}" size="1.778" layer="95"/>`;
      return `<net name="${xml(net.name || "N$1")}" class="0"><segment>${refs}${wires}${junctions}${label}</segment></net>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
<drawing>
<settings><setting alwaysvectorfont="no"/><setting verticaltext="up"/></settings>
<grid distance="0.1" unitdist="inch" unit="inch" style="lines" multiple="1" display="no" altdistance="0.01" altunitdist="inch" altunit="inch"/>
<layers>
${LAYERS.map(([n, nm, c]) => `<layer number="${n}" name="${nm}" color="${c}" fill="1" visible="yes" active="yes"/>`).join("\n")}
</layers>
<schematic xreflabel="%F%N/%S.%C%R" xrefpart="/%S.%C%R">
<libraries>
<library name="lovable">
<description>${xml(netlist.title ?? "Imported schematic")}</description>
<packages>
${packages.join("\n")}
</packages>
<symbols>
${symbols.join("\n")}
</symbols>
<devicesets>
${devicesets.join("\n")}
</devicesets>
</library>
</libraries>
<attributes/>
<variantdefs/>
<classes><class number="0" name="default" width="0" drill="0"/></classes>
<parts>
${parts.join("\n")}
</parts>
<sheets>
<sheet>
<plain/>
<instances>
${instances.join("\n")}
</instances>
<busses/>
<nets>
${nets}
</nets>
</sheet>
</sheets>
</schematic>
</drawing>
</eagle>
`;
}

