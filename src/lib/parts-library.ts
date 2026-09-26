// Curated component library: real pinouts, datasheets and LCSC SKUs.
// Used to label detected parts correctly and to suggest real pin connections.

import type { NetlistPin } from "./easyeda";

export interface LibraryPart {
  key: string;
  name: string; // canonical part name / MPN
  type: string; // resistor, capacitor, transistor, ic, diode, ...
  description: string;
  package?: string;
  lcsc?: string; // LCSC SKU, e.g. C7593
  datasheet?: string;
  keywords: string[];
  pins: NetlistPin[];
}

const p = (number: string, name: string, side: "left" | "right"): NetlistPin => ({
  number,
  name,
  side,
});

export const PARTS_LIBRARY: LibraryPart[] = [
  {
    key: "res",
    name: "Resistor",
    type: "resistor",
    description: "Generic chip resistor, 1%",
    package: "0603",
    lcsc: "C23162",
    datasheet: "https://www.lcsc.com/product-detail/C23162.html",
    keywords: ["r", "resistor", "ohm", "k", "kohm", "m"],
    pins: [p("1", "1", "left"), p("2", "2", "right")],
  },
  {
    key: "cap",
    name: "Ceramic capacitor",
    type: "capacitor",
    description: "MLCC X7R 50V",
    package: "0603",
    lcsc: "C14663",
    datasheet: "https://www.lcsc.com/product-detail/C14663.html",
    keywords: ["c", "capacitor", "nf", "pf", "uf", "ceramic", "mlcc"],
    pins: [p("1", "1", "left"), p("2", "2", "right")],
  },
  {
    key: "cap-el",
    name: "Electrolytic capacitor",
    type: "capacitor",
    description: "Aluminium electrolytic, polarised",
    package: "SMD/THT",
    lcsc: "C2686",
    datasheet: "https://www.lcsc.com/product-detail/C2686.html",
    keywords: ["electrolytic", "polarised", "polarized", "uf", "10uf", "100uf"],
    pins: [p("1", "+", "left"), p("2", "-", "right")],
  },
  {
    key: "ind",
    name: "Inductor",
    type: "inductor",
    description: "Power inductor",
    lcsc: "C1046",
    keywords: ["l", "inductor", "uh", "mh", "choke"],
    pins: [p("1", "1", "left"), p("2", "2", "right")],
  },
  {
    key: "led",
    name: "LED",
    type: "diode",
    description: "Standard indicator LED",
    package: "0805",
    lcsc: "C2286",
    datasheet: "https://www.lcsc.com/product-detail/C2286.html",
    keywords: ["led", "d", "indicator", "light"],
    pins: [p("1", "A", "left"), p("2", "K", "right")],
  },
  {
    key: "1n4148",
    name: "1N4148",
    type: "diode",
    description: "Fast switching signal diode, 100V",
    package: "DO-35 / SOD-123",
    lcsc: "C81598",
    datasheet: "https://www.lcsc.com/product-detail/C81598.html",
    keywords: ["1n4148", "signal diode", "switching diode"],
    pins: [p("1", "A", "left"), p("2", "K", "right")],
  },
  {
    key: "1n4007",
    name: "1N4007",
    type: "diode",
    description: "1A 1000V rectifier diode",
    package: "DO-41",
    lcsc: "C64898",
    datasheet: "https://www.lcsc.com/product-detail/C64898.html",
    keywords: ["1n4007", "rectifier", "1n400"],
    pins: [p("1", "A", "left"), p("2", "K", "right")],
  },
  {
    key: "1n5819",
    name: "1N5819",
    type: "diode",
    description: "1A 40V Schottky diode",
    package: "DO-41 / SOD-123",
    lcsc: "C8598",
    keywords: ["1n5819", "schottky", "ss14"],
    pins: [p("1", "A", "left"), p("2", "K", "right")],
  },
  {
    key: "zener",
    name: "Zener diode",
    type: "diode",
    description: "Voltage reference / clamp diode",
    lcsc: "C8039",
    keywords: ["zener", "bzx", "5v1", "3v3 zener"],
    pins: [p("1", "A", "left"), p("2", "K", "right")],
  },
  {
    key: "2n3904",
    name: "2N3904",
    type: "transistor",
    description: "NPN small-signal BJT, 200mA 40V",
    package: "TO-92 / SOT-23",
    lcsc: "C20526",
    datasheet: "https://www.lcsc.com/product-detail/C20526.html",
    keywords: ["2n3904", "npn", "q", "bjt", "transistor"],
    pins: [p("1", "E", "left"), p("2", "B", "left"), p("3", "C", "right")],
  },
  {
    key: "2n3906",
    name: "2N3906",
    type: "transistor",
    description: "PNP small-signal BJT, 200mA 40V",
    package: "TO-92 / SOT-23",
    lcsc: "C20527",
    keywords: ["2n3906", "pnp"],
    pins: [p("1", "E", "left"), p("2", "B", "left"), p("3", "C", "right")],
  },
  {
    key: "bc547",
    name: "BC547",
    type: "transistor",
    description: "NPN general purpose BJT, 100mA 45V",
    package: "TO-92",
    lcsc: "C114410",
    keywords: ["bc547", "bc548", "bc337", "npn"],
    pins: [p("1", "C", "right"), p("2", "B", "left"), p("3", "E", "left")],
  },
  {
    key: "2n7002",
    name: "2N7002",
    type: "transistor",
    description: "N-channel MOSFET, 60V 300mA",
    package: "SOT-23",
    lcsc: "C8545",
    datasheet: "https://www.lcsc.com/product-detail/C8545.html",
    keywords: ["2n7002", "mosfet", "nmos", "n-channel"],
    pins: [p("1", "G", "left"), p("2", "S", "left"), p("3", "D", "right")],
  },
  {
    key: "irlz44n",
    name: "IRLZ44N",
    type: "transistor",
    description: "Logic-level N-channel MOSFET, 55V 47A",
    package: "TO-220",
    lcsc: "C129860",
    keywords: ["irlz44", "irf540", "power mosfet"],
    pins: [p("1", "G", "left"), p("2", "D", "right"), p("3", "S", "left")],
  },
  {
    key: "ne555",
    name: "NE555",
    type: "ic",
    description: "Precision timer, astable / monostable",
    package: "DIP-8 / SOIC-8",
    lcsc: "C7593",
    datasheet: "https://www.lcsc.com/product-detail/C7593.html",
    keywords: ["555", "ne555", "se555", "timer", "lm555"],
    pins: [
      p("1", "GND", "left"),
      p("2", "TRIG", "left"),
      p("3", "OUT", "right"),
      p("4", "RESET", "left"),
      p("5", "CTRL", "left"),
      p("6", "THRES", "left"),
      p("7", "DISCH", "right"),
      p("8", "VCC", "right"),
    ],
  },
  {
    key: "lm358",
    name: "LM358",
    type: "ic",
    description: "Dual general-purpose op-amp",
    package: "DIP-8 / SOIC-8",
    lcsc: "C7950",
    datasheet: "https://www.lcsc.com/product-detail/C7950.html",
    keywords: ["lm358", "op-amp", "opamp", "dual op amp"],
    pins: [
      p("1", "OUT1", "right"),
      p("2", "IN1-", "left"),
      p("3", "IN1+", "left"),
      p("4", "GND", "left"),
      p("5", "IN2+", "left"),
      p("6", "IN2-", "left"),
      p("7", "OUT2", "right"),
      p("8", "VCC", "right"),
    ],
  },
  {
    key: "tl072",
    name: "TL072",
    type: "ic",
    description: "Dual low-noise JFET op-amp",
    package: "DIP-8 / SOIC-8",
    lcsc: "C6961",
    keywords: ["tl072", "tl082", "jfet opamp"],
    pins: [
      p("1", "OUT1", "right"),
      p("2", "IN1-", "left"),
      p("3", "IN1+", "left"),
      p("4", "VEE", "left"),
      p("5", "IN2+", "left"),
      p("6", "IN2-", "left"),
      p("7", "OUT2", "right"),
      p("8", "VCC", "right"),
    ],
  },
  {
    key: "lm324",
    name: "LM324",
    type: "ic",
    description: "Quad general-purpose op-amp",
    package: "DIP-14 / SOIC-14",
    lcsc: "C71035",
    keywords: ["lm324", "quad opamp"],
    pins: [
      p("1", "OUT1", "right"),
      p("2", "IN1-", "left"),
      p("3", "IN1+", "left"),
      p("4", "VCC", "right"),
      p("5", "IN2+", "left"),
      p("6", "IN2-", "left"),
      p("7", "OUT2", "right"),
      p("8", "OUT3", "right"),
      p("9", "IN3-", "left"),
      p("10", "IN3+", "left"),
      p("11", "GND", "left"),
      p("12", "IN4+", "left"),
      p("13", "IN4-", "left"),
      p("14", "OUT4", "right"),
    ],
  },
  {
    key: "lm393",
    name: "LM393",
    type: "ic",
    description: "Dual differential comparator",
    package: "DIP-8 / SOIC-8",
    lcsc: "C7972",
    keywords: ["lm393", "comparator"],
    pins: [
      p("1", "OUT1", "right"),
      p("2", "IN1-", "left"),
      p("3", "IN1+", "left"),
      p("4", "GND", "left"),
      p("5", "IN2+", "left"),
      p("6", "IN2-", "left"),
      p("7", "OUT2", "right"),
      p("8", "VCC", "right"),
    ],
  },
  {
    key: "lm7805",
    name: "LM7805",
    type: "ic",
    description: "5V 1A linear regulator",
    package: "TO-220",
    lcsc: "C55051",
    datasheet: "https://www.lcsc.com/product-detail/C55051.html",
    keywords: ["7805", "lm7805", "l7805", "regulator 5v"],
    pins: [p("1", "IN", "left"), p("2", "GND", "left"), p("3", "OUT", "right")],
  },
  {
    key: "ams1117",
    name: "AMS1117-3.3",
    type: "ic",
    description: "3.3V 1A LDO regulator",
    package: "SOT-223",
    lcsc: "C6186",
    datasheet: "https://www.lcsc.com/product-detail/C6186.html",
    keywords: ["ams1117", "1117", "ldo", "3.3v regulator"],
    pins: [p("1", "GND", "left"), p("2", "OUT", "right"), p("3", "IN", "left")],
  },
  {
    key: "lm317",
    name: "LM317",
    type: "ic",
    description: "Adjustable linear regulator, 1.5A",
    package: "TO-220",
    lcsc: "C22697",
    keywords: ["lm317", "adjustable regulator"],
    pins: [p("1", "ADJ", "left"), p("2", "OUT", "right"), p("3", "IN", "left")],
  },
  {
    key: "atmega328p",
    name: "ATmega328P-PU",
    type: "ic",
    description: "8-bit AVR microcontroller, 28-pin DIP",
    package: "DIP-28",
    lcsc: "C14877",
    datasheet: "https://www.lcsc.com/product-detail/C14877.html",
    keywords: ["atmega328", "atmega", "arduino", "avr"],
    pins: [
      p("1", "RESET", "left"),
      p("2", "PD0/RX", "left"),
      p("3", "PD1/TX", "left"),
      p("4", "PD2", "left"),
      p("5", "PD3", "left"),
      p("6", "PD4", "left"),
      p("7", "VCC", "left"),
      p("8", "GND", "left"),
      p("9", "XTAL1", "left"),
      p("10", "XTAL2", "left"),
      p("11", "PD5", "left"),
      p("12", "PD6", "left"),
      p("13", "PD7", "left"),
      p("14", "PB0", "left"),
      p("15", "PB1", "right"),
      p("16", "PB2", "right"),
      p("17", "PB3/MOSI", "right"),
      p("18", "PB4/MISO", "right"),
      p("19", "PB5/SCK", "right"),
      p("20", "AVCC", "right"),
      p("21", "AREF", "right"),
      p("22", "GND", "right"),
      p("23", "PC0", "right"),
      p("24", "PC1", "right"),
      p("25", "PC2", "right"),
      p("26", "PC3", "right"),
      p("27", "PC4/SDA", "right"),
      p("28", "PC5/SCL", "right"),
    ],
  },
  {
    key: "uln2003",
    name: "ULN2003A",
    type: "ic",
    description: "7-channel Darlington driver array",
    package: "DIP-16 / SOIC-16",
    lcsc: "C7512",
    keywords: ["uln2003", "darlington", "driver array"],
    pins: [
      p("1", "IN1", "left"),
      p("2", "IN2", "left"),
      p("3", "IN3", "left"),
      p("4", "IN4", "left"),
      p("5", "IN5", "left"),
      p("6", "IN6", "left"),
      p("7", "IN7", "left"),
      p("8", "GND", "left"),
      p("9", "COM", "right"),
      p("10", "OUT7", "right"),
      p("11", "OUT6", "right"),
      p("12", "OUT5", "right"),
      p("13", "OUT4", "right"),
      p("14", "OUT3", "right"),
      p("15", "OUT2", "right"),
      p("16", "OUT1", "right"),
    ],
  },
  {
    key: "crystal",
    name: "Crystal",
    type: "crystal",
    description: "Quartz crystal resonator",
    lcsc: "C12674",
    keywords: ["crystal", "xtal", "mhz", "quartz", "y1"],
    pins: [p("1", "1", "left"), p("2", "2", "right")],
  },
  {
    key: "switch",
    name: "Tactile switch",
    type: "switch",
    description: "SPST momentary push button",
    lcsc: "C318884",
    keywords: ["switch", "button", "sw", "tactile", "push"],
    pins: [p("1", "1", "left"), p("2", "2", "right")],
  },
  {
    key: "header2",
    name: "2-pin header",
    type: "connector",
    description: "2.54mm pin header / terminal",
    lcsc: "C124378",
    keywords: ["header", "connector", "j", "terminal", "screw"],
    pins: [p("1", "1", "left"), p("2", "2", "right")],
  },
  {
    key: "relay",
    name: "SRD-05VDC relay",
    type: "relay",
    description: "5V SPDT power relay, 10A contacts",
    lcsc: "C36835",
    keywords: ["relay", "srd", "spdt"],
    pins: [
      p("1", "COIL+", "left"),
      p("2", "COIL-", "left"),
      p("3", "COM", "right"),
      p("4", "NO", "right"),
      p("5", "NC", "right"),
    ],
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");

export function searchLibrary(query: string, limit = 8): LibraryPart[] {
  const q = norm(query);
  if (!q) return PARTS_LIBRARY.slice(0, limit);
  const scored = PARTS_LIBRARY.map((part) => {
    const hay = [part.name, part.type, part.description, ...part.keywords].map(norm);
    let score = 0;
    hay.forEach((h, i) => {
      if (h === q) score += i === 0 ? 100 : 60;
      else if (h.includes(q) || q.includes(h)) score += i === 0 ? 40 : 20;
    });
    return { part, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.part);
}

/** Best library match for a detected component (designator + type + value). */
export function matchPart(input: {
  id: string;
  type?: string;
  value?: string;
  pinCount?: number;
}): LibraryPart | null {
  const text = `${input.value ?? ""} ${input.type ?? ""}`.trim();
  const direct = text ? searchLibrary(text, 3)[0] : undefined;
  if (direct) return direct;

  const prefix = (input.id.match(/^[A-Za-z]+/)?.[0] ?? "").toUpperCase();
  const byPrefix: Record<string, string> = {
    R: "res",
    C: "cap",
    L: "ind",
    D: "led",
    Q: "2n3904",
    U: "ne555",
    SW: "switch",
    S: "switch",
    J: "header2",
    P: "header2",
    Y: "crystal",
    X: "crystal",
    K: "relay",
  };
  const key = byPrefix[prefix];
  const part = PARTS_LIBRARY.find((x) => x.key === key);
  if (!part) return null;
  if (prefix === "U" && input.pinCount && input.pinCount !== part.pins.length) return null;
  return part;
}

