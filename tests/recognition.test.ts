import { describe, expect, test } from "bun:test";
import { applyLibrary, normalizeRecognition, reviewMessage, SYSTEM, VERIFY, JSON_SCHEMA } from "../src/lib/recognition";
import type { Netlist } from "../src/lib/easyeda";
import { PARTS_LIBRARY } from "../src/lib/parts-library";

describe("recognition preserves evidence rather than guessing", () => {
  const fixture = (): Netlist => ({
    sourceStyle: "hand-drawn",
    components: [{ id: "R1", type: "resistor", value: "unknown", confidence: 0.4, reviewReason: "Handwriting could be 1k or 7k", x: 0.2, y: 0.3, pins: [{ number: "1", name: "1", x: 0.1, y: 0.3 }, { number: "2", name: "2", x: 0.3, y: 0.3 }] }],
    nets: [{ name: "NET1", confidence: 0.3, reviewReason: "Crossing has no clear junction dot", connections: [{ component: "R1", pin: "1" }], paths: [[{ x: 0.1, y: 0.3 }, { x: 0.1, y: 0.6 }]] }],
  });

  test("parse and enrichment retain uncertainty, original pin anchors and paths", () => {
    const input = fixture();
    expect(applyLibrary(normalizeRecognition(input))).toEqual(input);
  });

  test("missing, null and blank values stay explicitly unknown", () => {
    for (const value of [undefined, null, "", "   "]) {
      const input = fixture();
      const parsed = normalizeRecognition({ ...input, components: [{ ...input.components[0], value, reviewReason: undefined }] });
      expect(parsed.components[0]?.value).toBe("unknown");
      expect(reviewMessage(parsed.components[0]!)).toContain("Value unreadable");
      expect(applyLibrary(parsed).components[0]?.value).toBe("unknown");
    }
  });

  test("unknown eight-pin IC is never assigned a 555 from its U designator", () => {
    const input: Netlist = { components: [{ id: "U1", type: "ic", pins: Array.from({ length: 8 }, (_, i) => ({ number: String(i + 1), name: "unknown" })) }], nets: [] };
    expect(applyLibrary(input)).toEqual(input);
  });

  test("exact NE555 match enriches by pin number without moving or reordering pins", () => {
    const part = PARTS_LIBRARY.find((p) => p.name === "NE555")!;
    const pins = [...part.pins].reverse().map((p, i) => ({ ...p, name: "unknown", x: i / 10, y: 0.5 }));
    const input: Netlist = { components: [{ id: "IC1", type: "ic", value: "NE555", pins }], nets: [] };
    const output = applyLibrary(input).components[0]!;
    expect(output.pins.map(({ number, x, y }) => ({ number, x, y }))).toEqual(pins.map(({ number, x, y }) => ({ number, x, y })));
    expect(output.pins[0]?.name).toBe(part.pins.find((p) => p.number === pins[0]?.number)?.name);
    expect(output.lcsc).toBeUndefined();
  });

  test("contradictory type or uncertain MPN cannot override recognized evidence", () => {
    for (const patch of [{ type: "capacitor" }, { reviewReason: "Part marking unclear" }, { confidence: 0.3 }]) {
      const pins = PARTS_LIBRARY.find((p) => p.name === "NE555")!.pins;
      const input: Netlist = { components: [{ id: "IC1", type: "ic", value: "NE555", pins, ...patch }], nets: [] };
      expect(applyLibrary(input)).toEqual(input);
    }
  });

  test("rejects invalid confidence and keeps valid zero confidence visible", () => {
    expect(() => normalizeRecognition({ ...fixture(), nets: [{ ...fixture().nets[0], confidence: 1.2 }] })).toThrow();
    expect(reviewMessage({ confidence: 0 })).toContain("Low-confidence");
  });

  test("clean CAD coordinates and known values survive the same pipeline", () => {
    const input = fixture(); input.sourceStyle = "cad";
    input.components[0] = { ...input.components[0]!, value: "10k", confidence: 0.98, reviewReason: "" };
    expect(applyLibrary(normalizeRecognition(input))).toEqual(input);
    expect(reviewMessage(input.components[0]!)).toBeNull();
  });

  test("both passes receive graph-paper, original-frame and uncertainty instructions", () => {
    for (const prompt of [SYSTEM, VERIFY]) {
      expect(prompt).toContain("Grid lines are BACKGROUND");
      expect(prompt).toContain("ORIGINAL supplied image frame");
      expect(prompt).toContain('value "unknown"');
      expect(prompt).toContain("potentiometer (three pins including wiper)");
    }
    expect(VERIFY).toContain("Trace EVERY net pin-to-pin");
    expect(VERIFY).toContain("visibly identified 555");
    expect(JSON_SCHEMA.schema.properties.components.items.properties.confidence.maximum).toBe(1);
  });
});
