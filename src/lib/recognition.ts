import { z } from "zod";
import type { Netlist, NetlistComponent } from "./easyeda";
import { PARTS_LIBRARY } from "./parts-library";
import { SYMBOL_KINDS } from "./schematic-symbols";

export const HAND_DRAWN_RULES = `
- Determine sourceStyle: hand-drawn, cad, or unknown. Apply these checks to both CAD and photographed drawings.
- For hand-drawn schematics, distinguish graph-paper/notebook grid lines from deliberate electrical strokes. Grid lines are BACKGROUND, never wires or nets, even at intersections.
- Handle shadows, skew, sideways images, rotated/vertical handwriting and uneven spacing. Mentally rotate to read, but report ALL coordinates in the ORIGINAL supplied image frame; do not rotate just some objects.
- Trace intentional continuous strokes between actual component pin endpoints. Use junction dots, branches and supply/battery rail topology as evidence. A crossing alone is NOT a junction. If ambiguous, preserve uncertainty; never silently connect it.
- Recognize distorted approximate standard symbols: resistor, capacitor/polarized capacitor, potentiometer (three pins including wiper), diode/LED, transistor, IC block, battery/power and ground. Use generic with a reviewReason for unsupported symbols rather than silently converting them to a different electrical component.
- Cross-check handwriting against symbol geometry. A handwritten R label must not override an unmistakable capacitor symbol: flag the conflict.
- Never complete a circuit from a familiar textbook topology. Missing/unreadable pin numbers use unique temporary identifiers and reviewReason; do not silently infer their connections from a typical 555 circuit.
- Emit confidence in 0..1 for each component and net, as a heuristic reading score, NOT calibrated probability. Include a specific reviewReason for unclear value, symbol, pin, wire or junction. Use value "unknown" when unreadable, absent, or ambiguous (alternatives belong in reviewReason).
- Preserve source positions, pin anchors, wire bends and junction positions. Do not redraw onto an invented regular layout.
`;

export const VERIFICATION_RULES = `
- Independently recount visible symbols and labels (including R1/R2/R3/R4, C1/C2, IC1 when actually present), LEDs and potentiometer wipers; do not assume this example's parts exist in every image.
- For a visibly identified 555, check visible pin numbers against the image; compare known pin names only after identification. Do not supply missing wires from the standard astable circuit.
- Trace EVERY net pin-to-pin, distinguish crossings from junction dots and reject graph-paper false nets. Delete unsupported connections; keep uncertain endpoints out of definite nets and explain in reviewReason/notes.
- Preserve unknown values and review reasons unless the original image clearly resolves them. Do not raise confidence simply because the candidate looks electrically plausible.
`;

export const NetlistSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  sourceStyle: z.enum(["hand-drawn", "cad", "unknown"]).optional(),
  components: z.array(
    z.object({
      confidence: z.number().min(0).max(1).optional(),
      reviewReason: z.string().optional(),
      id: z.string(),
      type: z.string(),
      value: z.string().nullable().optional().transform((value) => value?.trim() || "unknown"),
      part: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      orientation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
      symbolKind: z.enum(SYMBOL_KINDS as [string, ...string[]]).optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      pins: z.array(
        z.object({
          number: z.string(),
          name: z.string(),
          side: z.enum(["left", "right"]).optional(),
          x: z.number().optional(),
          y: z.number().optional(),
        }),
      ),
    }),
  ),
  nets: z.array(
    z.object({
      confidence: z.number().min(0).max(1).optional(),
      reviewReason: z.string().optional(),
      name: z.string(),
      connections: z.array(z.object({ component: z.string(), pin: z.string() })),
      paths: z.array(z.array(z.object({ x: z.number(), y: z.number() }))).optional(),
      junctions: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
      label: z.object({ x: z.number(), y: z.number() }).optional(),
    }),
  ),
});

const KNOWN_PARTS = PARTS_LIBRARY.map(
  (p) => `${p.name} (${p.type}, pins: ${p.pins.map((x) => `${x.number}=${x.name}`).join(", ")})`,
).join("\n");

export const SYSTEM = `You are an expert electronics engineer that reads schematic/circuit diagram images and produces a precise netlist.
Rules:
${HAND_DRAWN_RULES}
- Identify every component: designator (R1, C2, U1, Q1, D1, J1...), type, and value/part number if printed.
- Classify types using the visible symbol: resistor, capacitor, inductor, diode, transistor, ic, crystal, switch, connector, relay, potentiometer, battery, power, ground, or generic.
  Use the schematic SYMBOL, not just the label: zig-zag/box = resistor, two parallel plates = capacitor,
  triangle+bar = diode/LED, circle with three leads or arrow on emitter = transistor, rectangle with numbered pins = IC.
- When the part matches one of these known devices, use its exact pin numbering and pin names:
${KNOWN_PARTS}
- List every pin with number and name (passives: "1"/"2"; ICs and transistors: real datasheet pins).
- Give normalized centre coordinates x/y and width/height in 0..1 matching the symbol bounding box in the image.
- Give each component's clockwise orientation as exactly 0, 90, 180, or 270 degrees, matching its symbol in the image.
- Set symbolKind to the closest standard schematic symbol: resistor-ansi, resistor-iec, capacitor, capacitor-polarized, inductor, diode, led, zener, schottky, bjt-npn, bjt-pnp, nmos, pmos, opamp, ic, relay, switch, crystal, connector, ground, power, generic.
- For every pin, give its exact normalized x/y anchor where the wire touches the pin in the image.
- For every net, trace every visible intentional wire (including diagonal hand-drawn segments) as paths: arrays of normalized x/y turn points. Include visible junction dots and net-label position. Do not replace visible wire geometry with a newly invented route.
- Produce nets: every electrical node, named (GND, VCC, +5V, NET1...), listing all connected component pins.
- Never invent components, values, part numbers or connections. Use value "unknown" for unreadable or absent values. For unreadable designators use a unique temporary ID and explain it in reviewReason.
Return JSON only, matching the requested schema exactly.`;

export const VERIFY = `You are reviewing a netlist another engineer extracted from the SAME schematic image.
Check it against the image and return a corrected netlist:
${HAND_DRAWN_RULES}
${VERIFICATION_RULES}
- Remove parts that are not in the image, add parts that were missed.
- Fix wrong component types, values, designators and pin numbering (use datasheet pin names for known ICs/transistors).
- Fix nets: every wire junction in the image is one net; pins joined by a wire must share a net. Split nets that were merged, merge nets that are the same node.
- Correct coordinates, component bounding boxes, exact pin anchors, every wire turn, junction dot and label position to match the image.
- Preserve or correct each component orientation (0, 90, 180, or 270 degrees) to match the image.
Return the full corrected netlist JSON only, in the same schema.`;

export const JSON_SCHEMA = {
  name: "netlist",
  strict: false,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      notes: { type: "string" },
      sourceStyle: { type: "string", enum: ["hand-drawn", "cad", "unknown"] },
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reviewReason: { type: "string" },
            id: { type: "string" },
            type: { type: "string" },
            value: { type: "string" },
            part: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            orientation: { type: "number", enum: [0, 90, 180, 270] },
            symbolKind: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
            pins: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  number: { type: "string" },
                  name: { type: "string" },
                  side: { type: "string", enum: ["left", "right"] },
                  x: { type: "number" },
                  y: { type: "number" },
                },
                required: ["number", "name"],
              },
            },
          },
          required: ["id", "type", "pins"],
        },
      },
      nets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reviewReason: { type: "string" },
            name: { type: "string" },
            connections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  component: { type: "string" },
                  pin: { type: "string" },
                },
                required: ["component", "pin"],
              },
            },
            paths: { type: "array", items: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] } } },
            junctions: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] } },
            label: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
          },
          required: ["name", "connections"],
        },
      },
    },
    required: ["components", "nets"],
  },
};


/** Enrichment must never guess an MPN from a reference prefix or pin count. */
export function applyLibrary(netlist: Netlist): Netlist {
  return {
    ...netlist,
    components: netlist.components.map((component) => {
      // A conservative exact visible-name match; manual PartPicker still offers fuzzy suggestions.
      const labels = [component.part, component.value].filter(Boolean).map((s) => s!.trim().toLowerCase());
      const part = PARTS_LIBRARY.find((p) => labels.includes(p.name.toLowerCase()));
      if (!part || component.type !== part.type || component.reviewReason ||
          (component.confidence !== undefined && component.confidence < 0.8)) return component;
      const pinNumbers = component.pins.map((pin) => pin.number);
      if (new Set(pinNumbers).size !== pinNumbers.length || part.pins.length !== pinNumbers.length ||
          !part.pins.every((pin) => pinNumbers.includes(pin.number))) return component;
      return {
        ...component,
        part: part.name,
        // Preserve value (including unknown), geometry, order, numbers and detected names.
        // Library SKUs are suggestions, not evidence of the photographed physical part.
        pins: component.pins.map((pin) => {
          const known = part.pins.find((p) => p.number === pin.number);
          return { ...pin, name: pin.name && pin.name !== "unknown" ? pin.name : (known?.name ?? pin.name) };
        }),
      };
    }),
  };
}

export function reviewMessage(item: { confidence?: number; reviewReason?: string; value?: string }): string | null {
  const reasons = [item.reviewReason?.trim()];
  if (item.value === "unknown") reasons.push("Value unreadable or not provided.");
  if (item.confidence !== undefined && item.confidence < 0.8) reasons.push("Low-confidence reading; check the source image.");
  return reasons.filter(Boolean).join(" ") || null;
}

export function normalizeRecognition(input: unknown): Netlist {
  const parsed = NetlistSchema.parse(input) as Netlist;
  return {
    ...parsed,
    components: parsed.components.map((component): NetlistComponent => ({
      ...component,
      ...(component.value === "unknown" && !component.reviewReason
        ? { reviewReason: "Value unreadable or not provided; check the source image." } : {}),
    })),
  };
}
