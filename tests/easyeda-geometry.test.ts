import { describe, expect, test } from "bun:test";
import { netlistToEasyEda, type Netlist } from "../src/lib/easyeda";
import { validateEasyEda } from "../src/lib/validate";
import { verifyExports } from "../src/lib/verify";
import { circuitFixtures } from "./fixtures";

const geometry: Netlist = {
  title: "Image geometry",
  components: [
    { id: "R1", type: "resistor", x: 0.2, y: 0.3, width: 0.1, height: 0.05, orientation: 0, pins: [
      { number: "1", name: "A", side: "left", x: 0.14, y: 0.3 },
      { number: "2", name: "B", side: "right", x: 0.26, y: 0.3 },
    ] },
    { id: "R2", type: "resistor", x: 0.75, y: 0.7, width: 0.05, height: 0.1, orientation: 90, pins: [
      { number: "1", name: "A", side: "left", x: 0.75, y: 0.64 },
      { number: "2", name: "B", side: "right", x: 0.75, y: 0.76 },
    ] },
    { id: "R3", type: "resistor", x: 0.52, y: 0.2, orientation: 180, pins: [
      { number: "1", name: "A", side: "left" }, { number: "2", name: "B", side: "right" },
    ] },
    { id: "R4", type: "resistor", x: 0.52, y: 0.85, orientation: 270, pins: [
      { number: "1", name: "A", side: "left" }, { number: "2", name: "B", side: "right" },
    ] },
  ],
  nets: [{ name: "SIGNAL", connections: [{ component: "R1", pin: "2" }, { component: "R2", pin: "1" }],
    paths: [[{ x: 0.26, y: 0.3 }, { x: 0.4, y: 0.3 }, { x: 0.4, y: 0.5 }, { x: 0.75, y: 0.5 }, { x: 0.75, y: 0.64 }]],
    junctions: [{ x: 0.4, y: 0.5 }], label: { x: 0.4, y: 0.3 },
  }],
};

const lib = (doc: ReturnType<typeof netlistToEasyEda>, id: string) =>
  doc.shape.find((shape) => shape.startsWith("LIB~") && shape.includes(`spiceSymbolName\`${id}\``)) ?? "";
const pins = (shape: string) => [...shape.matchAll(/P~show~0~([^~]+)~([^~]+)~([^~]+)~([^~]+)~/g)].map((m) => ({
  number: m[1], x: Number(m[2]), y: Number(m[3]), rotation: Number(m[4]),
}));

describe("EasyEDA source fidelity", () => {
  test("preserves relative positions, image bounds, pin anchors and four orientations", () => {
    const doc = netlistToEasyEda(geometry);
    expect(doc.BBox).toEqual({ x: 0, y: 0, width: 1480, height: 1040 });
    expect(lib(doc, "R1")).toStartWith("LIB~380~360~");
    expect(lib(doc, "R2")).toStartWith("LIB~1040~680~");
    expect(lib(doc, "R1")).toContain("R~320~340~~~120~40~");
    expect(lib(doc, "R2")).toContain("R~1010~640~~~60~80~");
    expect(pins(lib(doc, "R1"))).toEqual([
      { number: "1", x: 308, y: 360, rotation: 0 },
      { number: "2", x: 452, y: 360, rotation: 180 },
    ]);
    expect(pins(lib(doc, "R2"))).toEqual([
      { number: "1", x: 1040, y: 632, rotation: 90 },
      { number: "2", x: 1040, y: 728, rotation: 270 },
    ]);
    expect(pins(lib(doc, "R3")).map((p) => p.rotation)).toEqual([180, 0]);
    expect(pins(lib(doc, "R4")).map((p) => p.rotation)).toEqual([270, 90]);
    expect(pins(lib(doc, "R3"))[0]?.x).toBeGreaterThan(764);
    expect(pins(lib(doc, "R4"))[0]?.y).toBeGreaterThan(800);
  });

  test("keeps each orthogonal turn and maps junctions and labels identically", () => {
    const doc = netlistToEasyEda(geometry);
    expect(doc.shape.filter((shape) => shape.startsWith("W~"))).toEqual([
      "W~452 360 620 360 620 520 1040 520 1040 632~#008800~1~0~none~gge5000~0",
    ]);
    expect(doc.shape).toContain("J~620~520~2.5~#008800~gge5001~0~");
    expect(doc.shape).toContain("N~620~360~0~#008800~SIGNAL~start~~9pt~gge5002~0~SIGNAL");
    expect(validateEasyEda(doc).filter((issue) => issue.level === "error")).toEqual([]);
    expect(JSON.parse(JSON.stringify(doc)).shape).toEqual(doc.shape);
  });

  test("routes missing paths from mapped detected pin anchors without rearranging components", () => {
    const incomplete = structuredClone(geometry);
    delete incomplete.nets[0]?.paths;
    const doc = netlistToEasyEda(incomplete);
    expect(lib(doc, "R1")).toStartWith("LIB~380~360~");
    expect(doc.shape.filter((shape) => shape.startsWith("W~")).length).toBeGreaterThan(0);
    expect(validateEasyEda(doc).filter((issue) => issue.level === "error")).toEqual([]);
  });

  test("legacy projects without source positions keep automatic placement and routing", () => {
    const old = circuitFixtures[1];
    const doc = netlistToEasyEda(old);
    expect(doc.shape.filter((shape) => shape.startsWith("LIB~"))).toHaveLength(old.components.length);
    expect(doc.shape.some((shape) => shape.startsWith("W~"))).toBe(true);
    expect(doc.BBox.width).toBeLessThan(1480);
    expect(validateEasyEda(doc).filter((issue) => issue.level === "error")).toEqual([]);
  });

  test("partially positioned projects preserve known positions and only place missing parts", () => {
    const partial = structuredClone(geometry);
    delete partial.components[1]?.x;
    const doc = netlistToEasyEda(partial);
    expect(lib(doc, "R1")).toStartWith("LIB~380~360~");
    expect(lib(doc, "R2")).toStartWith("LIB~1508~520~");
    expect(doc.BBox.width).toBe(1720);
    expect(doc.shape.some((shape) => shape.startsWith("W~452 360 620 360"))).toBe(true);
    expect(validateEasyEda(doc).filter((issue) => issue.level === "error")).toEqual([]);
  });

  test("KiCad and EAGLE still independently verify alongside EasyEDA", () => {
    const formats = verifyExports(geometry).formats;
    expect(formats.map((format) => [format.key, format.ok])).toEqual([
      ["easyeda", true], ["kicad", true], ["eagle", true],
    ]);
  });
});
