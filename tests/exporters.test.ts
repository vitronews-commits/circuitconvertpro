import { describe, expect, test } from "bun:test";
import { netlistToEagle } from "../src/lib/eagle";
import { netlistToKicad } from "../src/lib/kicad";
import { validateEagle, validateKicad } from "../src/lib/validate";
import { circuitFixtures } from "./fixtures";
import { layoutNetlist } from "../src/lib/layout";
import { symbolKind } from "../src/lib/schematic-symbols";

describe("schematic exporter regressions", () => {
  circuitFixtures.forEach((fixture) => {
    test(`${fixture.title} exports deterministic, valid KiCad`, () => {
      const first = netlistToKicad(fixture);
      const second = netlistToKicad(fixture);
      expect(first).toBe(second);
      expect(validateKicad(first).filter((issue) => issue.level === "error")).toEqual([]);
      expect((first.match(/\n\s{2}\(symbol \(lib_id/g) ?? []).length).toBe(fixture.components.length);
    });

    test(`${fixture.title} exports complete EAGLE gates and connects`, () => {
      const output = netlistToEagle(fixture);
      expect(validateEagle(output).filter((issue) => issue.level === "error")).toEqual([]);
      expect((output.match(/<instance\s/g) ?? []).length).toBe(fixture.components.length);
      expect((output.match(/<connect\s/g) ?? []).length).toBe(
        fixture.components.reduce((total, component) => total + component.pins.length, 0),
      );
    });
  });

  test("EAGLE validation blocks missing gate references", () => {
    const valid = netlistToEagle(circuitFixtures[0]);
    const broken = valid.replace('gate="G$1" pin=', 'gate="MISSING" pin=');
    expect(validateEagle(broken).some((issue) => issue.level === "error" && issue.message.includes("missing gate reference"))).toBe(true);
  });

  test("EAGLE disambiguates component names that sanitize identically", () => {
    const collision = {
      title: "Name collision",
      components: [
        { id: "IC@1", type: "ic", pins: [{ number: "1", name: "A", side: "left" as const }] },
        { id: "IC_1", type: "ic", pins: [{ number: "1", name: "B", side: "right" as const }] },
      ],
      nets: [{ name: "N1", connections: [{ component: "IC@1", pin: "1" }, { component: "IC_1", pin: "1" }] }],
    };
    const output = netlistToEagle(collision);
    expect(output).toContain('deviceset="IC_1_DEV"');
    expect(output).toContain('deviceset="IC_1_2_DEV"');
    expect(validateEagle(output).filter((issue) => issue.level === "error")).toEqual([]);
  });

  test("preserves detected image geometry and wire turns", () => {
    const layout = layoutNetlist(circuitFixtures[0]);
    expect(layout.components[0]?.comp.orientation).toBe(90);
    expect(layout.components[0]?.x).toBeCloseTo(11.5);
    expect(layout.nets[0]?.segments).toHaveLength(3);
    expect(layout.nets[0]?.junctions).toEqual([{ x: 24, y: 20 }]);
  });

  test("maps component types to stable standard symbols", () => {
    expect(symbolKind({ type: "resistor", symbolKind: "resistor-ansi" })).toBe("resistor-ansi");
    expect(symbolKind({ type: "transistor", value: "PNP" })).toBe("bjt-pnp");
    expect(symbolKind({ type: "diode", value: "LED" })).toBe("led");
  });
});
