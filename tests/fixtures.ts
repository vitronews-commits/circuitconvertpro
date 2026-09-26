import type { Netlist } from "../src/lib/easyeda";

export const circuitFixtures: Netlist[] = [
  {
    title: "RC Filter",
    components: [
      { id: "R1", type: "resistor", symbolKind: "resistor-ansi", value: "10k", x: 0.25, y: 0.35, orientation: 90, pins: [{ number: "1", name: "A", side: "left", x: 0.25, y: 0.2 }, { number: "2", name: "B", side: "right", x: 0.25, y: 0.5 }] },
      { id: "C1", type: "capacitor", symbolKind: "capacitor", value: "100nF", x: 0.7, y: 0.6, pins: [{ number: "1", name: "+", side: "left", x: 0.58, y: 0.6 }, { number: "2", name: "-", side: "right", x: 0.82, y: 0.6 }] },
    ],
    nets: [{ name: "OUT", connections: [{ component: "R1", pin: "2" }, { component: "C1", pin: "1" }], paths: [[{ x: 0.25, y: 0.5 }, { x: 0.4, y: 0.5 }, { x: 0.4, y: 0.6 }, { x: 0.58, y: 0.6 }]], junctions: [{ x: 0.4, y: 0.5 }], label: { x: 0.42, y: 0.48 } }],
  },
  {
    title: "NPN Switch",
    components: [
      { id: "Q1", type: "transistor", part: "2N2222", pins: [{ number: "1", name: "E", side: "left" }, { number: "2", name: "B", side: "left" }, { number: "3", name: "C", side: "right" }] },
      { id: "R1", type: "resistor", value: "1k", pins: [{ number: "1", name: "1", side: "left" }, { number: "2", name: "2", side: "right" }] },
      { id: "D1", type: "diode", value: "LED", pins: [{ number: "1", name: "A", side: "left" }, { number: "2", name: "K", side: "right" }] },
    ],
    nets: [
      { name: "BASE", connections: [{ component: "R1", pin: "2" }, { component: "Q1", pin: "2" }] },
      { name: "COLL", connections: [{ component: "D1", pin: "2" }, { component: "Q1", pin: "3" }] },
    ],
  },
  {
    title: "Op Amp",
    components: [
      { id: "U1", type: "ic", part: "TL072", pins: [{ number: "1", name: "OUT A", side: "right" }, { number: "2", name: "IN A", side: "left" }, { number: "3", name: "IN A", side: "left" }, { number: "4", name: "V-", side: "left" }, { number: "8", name: "V+", side: "right" }] },
    ],
    nets: [{ name: "FEEDBACK", connections: [{ component: "U1", pin: "1" }, { component: "U1", pin: "2" }] }],
  },
];
