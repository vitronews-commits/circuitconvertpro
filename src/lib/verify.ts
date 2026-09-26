// Builds every export format and verifies each one on its own terms, so the
// UI can unlock a download only when that specific file is really valid.

import { netlistToEasyEda, type EasyEdaDoc, type Netlist } from "./easyeda";
import { netlistToKicad } from "./kicad";
import { netlistToEagle } from "./eagle";
import {
  summarize,
  validateEasyEda,
  validateEagle,
  validateKicad,
  validateNetlist,
  type Issue,
} from "./validate";

export type FormatKey = "easyeda" | "kicad" | "eagle";

export interface FormatExport {
  key: FormatKey;
  label: string;
  extension: string;
  mime: string;
  target: string;
  text: string;
  issues: Issue[];
  errors: number;
  warnings: number;
  ok: boolean;
  /** short human summary of what was checked */
  checks: string;
}

export interface Verification {
  easyedaDoc: EasyEdaDoc;
  circuit: { issues: Issue[]; errors: number; warnings: number; ok: boolean };
  formats: FormatExport[];
}

const slug = (s: string) =>
  s.replace(/\W+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "schematic";

export function fileNameFor(netlist: Netlist, f: FormatExport) {
  return `${slug(netlist.title ?? "schematic")}${f.extension}`;
}

export function verifyExports(netlist: Netlist): Verification {
  const easyedaDoc = netlistToEasyEda(netlist);
  const circuitIssues = validateNetlist(netlist);
  const circuitCounts = summarize(circuitIssues);

  const build = (
    key: FormatKey,
    label: string,
    extension: string,
    mime: string,
    target: string,
    checks: string,
    make: () => string,
    check: (text: string) => Issue[],
  ): FormatExport => {
    let text = "";
    let issues: Issue[] = [];
    try {
      text = make();
      issues = check(text);
    } catch (err) {
      issues = [
        {
          level: "error",
          message: `Could not build the ${label} file: ${err instanceof Error ? err.message : String(err)}`,
        },
      ];
    }
    // A broken circuit breaks every format.
    const all = [...circuitIssues.filter((i) => i.level === "error"), ...issues];
    const counts = summarize(all);
    return {
      key,
      label,
      extension,
      mime,
      target,
      text,
      issues: all,
      errors: counts.errors,
      warnings: counts.warnings,
      ok: counts.errors === 0 && text.length > 0,
      checks,
    };
  };

  const formats: FormatExport[] = [
    build(
      "easyeda",
      "EasyEDA",
      ".easyeda.json",
      "application/json",
      "EasyEDA: File → Open → EasyEDA",
      "JSON syntax, document header, symbols, wires",
      () => JSON.stringify(easyedaDoc, null, 2),
      () => validateEasyEda(easyedaDoc),
    ),
    build(
      "kicad",
      "KiCad",
      ".kicad_sch",
      "text/plain",
      "KiCad 6/7/8: File → Open",
      "bracket syntax, unique object ids, symbol library, 1.27 mm grid",
      () => netlistToKicad(netlist),
      validateKicad,
    ),
    build(
      "eagle",
      "EAGLE",
      ".sch",
      "application/xml",
      "Autodesk EAGLE / Fusion: File → Open",
      "XML well-formedness, required sections, part/gate/pin cross-references",
      () => netlistToEagle(netlist),
      validateEagle,
    ),
  ];

  return {
    easyedaDoc,
    circuit: {
      issues: circuitIssues,
      errors: circuitCounts.errors,
      warnings: circuitCounts.warnings,
      ok: circuitCounts.errors === 0,
    },
    formats,
  };
}

export function downloadText(filename: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

