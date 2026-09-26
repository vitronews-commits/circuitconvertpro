import type { NetlistComponent } from "./easyeda";

export type SymbolKind =
  | "resistor-ansi" | "resistor-iec" | "capacitor" | "capacitor-polarized"
  | "inductor" | "diode" | "led" | "zener" | "schottky"
  | "bjt-npn" | "bjt-pnp" | "nmos" | "pmos" | "opamp" | "ic"
  | "relay" | "switch" | "crystal" | "connector" | "ground" | "power" | "generic";

export const SYMBOL_KINDS: SymbolKind[] = [
  "resistor-ansi", "resistor-iec", "capacitor", "capacitor-polarized", "inductor",
  "diode", "led", "zener", "schottky", "bjt-npn", "bjt-pnp", "nmos", "pmos",
  "opamp", "ic", "relay", "switch", "crystal", "connector", "ground", "power", "generic",
];

export function symbolKind(component: Pick<NetlistComponent, "type" | "value" | "part" | "symbolKind">): SymbolKind {
  if (component.symbolKind && SYMBOL_KINDS.includes(component.symbolKind)) return component.symbolKind;
  const value = `${component.type} ${component.value ?? ""} ${component.part ?? ""}`.toLowerCase();
  if (/ground|\bgnd\b/.test(value)) return "ground";
  if (/power|\bvcc\b|\bvee\b|\+\d+v/.test(value)) return "power";
  if (/relay/.test(value)) return "relay";
  if (/connector|header|terminal|jack/.test(value)) return "connector";
  if (/op.?amp|lm358|tl07|lm324/.test(value)) return "opamp";
  if (/pmos|p-channel/.test(value)) return "pmos";
  if (/mosfet|nmos|n-channel/.test(value)) return "nmos";
  if (/pnp/.test(value)) return "bjt-pnp";
  if (/transistor|\bbjt\b|\bnpn\b/.test(value)) return "bjt-npn";
  if (/schottky/.test(value)) return "schottky";
  if (/zener/.test(value)) return "zener";
  if (/\bled\b/.test(value)) return "led";
  if (/diode/.test(value)) return "diode";
  if (/polar|electrolytic/.test(value)) return "capacitor-polarized";
  if (/capacitor/.test(value)) return "capacitor";
  if (/inductor|choke|coil/.test(value)) return "inductor";
  if (/crystal|oscillator/.test(value)) return "crystal";
  if (/switch|button/.test(value)) return "switch";
  if (/resistor/.test(value)) return "resistor-ansi";
  if (/\bic\b|microcontroller|timer|regulator|driver|comparator/.test(value)) return "ic";
  return "generic";
}
