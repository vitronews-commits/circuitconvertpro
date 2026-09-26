import type { Netlist } from "./easyeda";
import type { EasyEdaDoc } from "./easyeda";

export type IssueLevel = "error" | "warning";

export interface Issue {
  level: IssueLevel;
  message: string;
}

export function validateNetlist(netlist: Netlist): Issue[] {
  const issues: Issue[] = [];

  const seen = new Set<string>();
  netlist.components.forEach((c) => {
    if (seen.has(c.id)) {
      issues.push({ level: "error", message: `Duplicate designator "${c.id}".` });
    }
    seen.add(c.id);
    if (!c.id.trim()) {
      issues.push({ level: "error", message: "A component has no designator." });
    }
    if (c.pins.length === 0) {
      issues.push({ level: "error", message: `${c.id || "A component"} has no pins.` });
    }
    const pinNums = new Set<string>();
    c.pins.forEach((p) => {
      if (pinNums.has(p.number)) {
        issues.push({
          level: "error",
          message: `${c.id} has two pins numbered "${p.number}".`,
        });
      }
      pinNums.add(p.number);
    });
  });

  const connected = new Set<string>();
  const netNames = new Set<string>();
  netlist.nets.forEach((n) => {
    if (netNames.has(n.name)) {
      issues.push({ level: "warning", message: `Duplicate net name "${n.name}".` });
    }
    netNames.add(n.name);
    if (!n.name.trim()) {
      issues.push({ level: "error", message: "A net has no name." });
    }
    if (n.connections.length < 2) {
      issues.push({
        level: "warning",
        message: `Net "${n.name}" connects fewer than two pins — it will not be wired.`,
      });
    }
    n.connections.forEach((c) => {
      const comp = netlist.components.find((k) => k.id === c.component);
      if (!comp) {
        issues.push({
          level: "error",
          message: `Net "${n.name}" refers to unknown component "${c.component}".`,
        });
        return;
      }
      if (!comp.pins.some((p) => p.number === c.pin)) {
        issues.push({
          level: "error",
          message: `Net "${n.name}" refers to missing pin ${c.component}.${c.pin}.`,
        });
        return;
      }
      connected.add(`${c.component}.${c.pin}`);
    });
  });

  netlist.components.forEach((c) => {
    c.pins.forEach((p) => {
      if (!connected.has(`${c.id}.${p.number}`)) {
        issues.push({
          level: "warning",
          message: `${c.id}.${p.number} (${p.name}) is not connected to any net.`,
        });
      }
    });
  });

  return issues;
}

export function validateEasyEda(doc: EasyEdaDoc): Issue[] {
  const issues: Issue[] = [];
  if (!doc.head || !doc.canvas) {
    issues.push({ level: "error", message: "Export is missing its document header." });
  }
  if (!Array.isArray(doc.shape) || doc.shape.length === 0) {
    issues.push({ level: "error", message: "Export contains no drawable shapes." });
    return issues;
  }
  const libs = doc.shape.filter((s) => s.startsWith("LIB~"));
  const wires = doc.shape.filter((s) => s.startsWith("W~"));
  if (libs.length === 0) {
    issues.push({ level: "error", message: "Export contains no component symbols." });
  }
  if (wires.length === 0) {
    issues.push({ level: "warning", message: "Export contains no wires between pins." });
  }
  doc.shape.forEach((s, i) => {
    if (typeof s !== "string" || s.trim() === "") {
      issues.push({ level: "error", message: `Shape #${i + 1} is empty.` });
    }
  });
  try {
    JSON.parse(JSON.stringify(doc));
  } catch {
    issues.push({ level: "error", message: "Export is not valid JSON." });
  }
  return issues;
}

export function summarize(issues: Issue[]) {
  return {
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warning").length,
  };
}

// ---------------------------------------------------------------- KiCad

const GRID_MM = 1.27;

export function validateKicad(text: string): Issue[] {
  const issues: Issue[] = [];
  if (!text.trim().startsWith("(kicad_sch")) {
    issues.push({ level: "error", message: "File does not start with a KiCad schematic header." });
  }
  if (!/\(version\s+\d{8}\)/.test(text)) {
    issues.push({ level: "error", message: "KiCad file has no document version." });
  }

  // Balanced parentheses, ignoring anything inside quoted strings.
  let depth = 0;
  let inStr = false;
  let line = 1;
  let unbalanced = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\n") line += 1;
    if (inStr) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth < 0 && !unbalanced) {
        unbalanced = true;
        issues.push({
          level: "error",
          message: `KiCad syntax error: unexpected ")" on line ${line}.`,
        });
      }
    }
  }
  if (inStr) issues.push({ level: "error", message: "KiCad file has an unterminated text string." });
  if (depth > 0) {
    issues.push({ level: "error", message: `KiCad syntax error: ${depth} bracket(s) never closed.` });
  }

  for (const token of ["lib_symbols", "sheet_instances"]) {
    if (!text.includes(`(${token}`)) {
      issues.push({ level: "error", message: `KiCad file is missing its "${token}" block.` });
    }
  }

  const symbolCount = (text.match(/\n\s{2}\(symbol \(lib_id/g) ?? []).length;
  if (symbolCount === 0) {
    issues.push({ level: "error", message: "KiCad file places no components on the sheet." });
  }

  // Every placed symbol must have a matching library definition.
  const defined = new Set(
    Array.from(text.matchAll(/\(symbol\s+"(lovable:[^"]+)"/g), (m) => m[1] as string),
  );
  Array.from(text.matchAll(/\(lib_id\s+"([^"]+)"\)/g)).forEach((m) => {
    const libId = m[1] as string;
    if (!defined.has(libId)) {
      issues.push({
        level: "error",
        message: `KiCad symbol "${libId}" is used but not defined in the library block.`,
      });
    }
  });

  // UUID uniqueness — duplicates make KiCad refuse or corrupt the sheet.
  const uuids = Array.from(text.matchAll(/\(uuid\s+([0-9a-f-]{36})\)/g), (m) => m[1] as string);
  const seenUuid = new Set<string>();
  const dupes = new Set<string>();
  uuids.forEach((u) => (seenUuid.has(u) ? dupes.add(u) : seenUuid.add(u)));
  dupes.forEach((u) =>
    issues.push({ level: "error", message: `Duplicate KiCad object id ${u}.` }),
  );
  if (uuids.length === 0) {
    issues.push({ level: "error", message: "KiCad file contains no object ids." });
  }

  // Wires: on-grid and non-zero length.
  const wires = Array.from(
    text.matchAll(/\(wire \(pts \(xy (-?[\d.]+) (-?[\d.]+)\) \(xy (-?[\d.]+) (-?[\d.]+)\)\)/g),
  );
  if (wires.length === 0) {
    issues.push({ level: "warning", message: "KiCad file contains no wires between pins." });
  }
  let offGrid = 0;
  let zeroLen = 0;
  wires.forEach((m) => {
    const nums = [m[1], m[2], m[3], m[4]].map((v) => Number(v));
    nums.forEach((v) => {
      const r = Math.abs(v / GRID_MM - Math.round(v / GRID_MM));
      if (r > 0.01) offGrid += 1;
    });
    if (nums[0] === nums[2] && nums[1] === nums[3]) zeroLen += 1;
  });
  if (offGrid > 0) {
    issues.push({
      level: "error",
      message: `${offGrid} wire point(s) are off the 1.27 mm grid and would not connect.`,
    });
  }
  if (zeroLen > 0) {
    issues.push({ level: "error", message: `${zeroLen} wire(s) have zero length.` });
  }

  return issues;
}

// ---------------------------------------------------------------- EAGLE

function parseXml(text: string): { doc: Document | null; error?: string } {
  if (typeof DOMParser === "undefined") return { doc: null };
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) return { doc: null, error: err.textContent?.split("\n")[0] ?? "invalid XML" };
  return { doc };
}

function validateEagleMappingsFromText(text: string): Issue[] {
  const issues: Issue[] = [];
  const symbols = new Map<string, Set<string>>();
  for (const match of text.matchAll(/<symbol\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)) {
    if (symbols.has(match[1] as string)) {
      issues.push({ level: "error", message: `Duplicate EAGLE symbol name "${match[1]}".` });
    }
    symbols.set(
      match[1] as string,
      new Set(Array.from((match[2] as string).matchAll(/<pin\s+name="([^"]+)"/g), (pin) => pin[1] as string)),
    );
  }
  const packages = new Map<string, Set<string>>();
  for (const match of text.matchAll(/<package\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/package>/g)) {
    if (packages.has(match[1] as string)) {
      issues.push({ level: "error", message: `Duplicate EAGLE package name "${match[1]}".` });
    }
    packages.set(
      match[1] as string,
      new Set(Array.from((match[2] as string).matchAll(/<pad\s+name="([^"]+)"/g), (pad) => pad[1] as string)),
    );
  }
  const devicesets = new Set<string>();
  for (const match of text.matchAll(/<deviceset\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/deviceset>/g)) {
    const deviceset = match[1] as string;
    if (devicesets.has(deviceset)) {
      issues.push({ level: "error", message: `Duplicate EAGLE deviceset name "${deviceset}".` });
    }
    devicesets.add(deviceset);
    const body = match[2] as string;
    const gates = new Map(
      Array.from(body.matchAll(/<gate\s+name="([^"]+)"\s+symbol="([^"]+)"/g), (gate) => [gate[1] as string, gate[2] as string]),
    );
    if (gates.size === 0) {
      issues.push({ level: "error", message: `EAGLE deviceset "${deviceset}" has no gate reference.` });
    }
    gates.forEach((symbol, gate) => {
      if (!symbols.has(symbol)) {
        issues.push({ level: "error", message: `EAGLE gate "${gate}" refers to missing symbol "${symbol}".` });
      }
    });
    for (const device of body.matchAll(/<device\s+name="[^"]*"\s+package="([^"]+)"[^>]*>([\s\S]*?)<\/device>/g)) {
      const packageName = device[1] as string;
      const deviceBody = device[2] as string;
      if (!packages.has(packageName)) {
        issues.push({ level: "error", message: `EAGLE device refers to missing package "${packageName}".` });
      }
      const connects = Array.from(deviceBody.matchAll(/<connect\s+gate="([^"]+)"\s+pin="([^"]+)"\s+pad="([^"]+)"\/>/g));
      if (connects.length === 0) {
        issues.push({ level: "error", message: `EAGLE deviceset "${deviceset}" has no pin-to-pad connects.` });
      }
      connects.forEach((connect) => {
        const gate = connect[1] as string;
        const pin = connect[2] as string;
        const pad = connect[3] as string;
        const symbol = gates.get(gate);
        if (!symbol) issues.push({ level: "error", message: `EAGLE connect has missing gate reference "${gate}".` });
        else if (!symbols.get(symbol)?.has(pin)) issues.push({ level: "error", message: `EAGLE connect refers to missing symbol pin "${pin}".` });
        if (!packages.get(packageName)?.has(pad)) issues.push({ level: "error", message: `EAGLE connect refers to missing package pad "${pad}".` });
      });
    }
  }
  return issues;
}

export function validateEagle(text: string): Issue[] {
  const issues: Issue[] = [];
  if (!text.trimStart().startsWith("<?xml")) {
    issues.push({ level: "error", message: "EAGLE file is missing its XML declaration." });
  }
  if (!/<eagle[\s>]/.test(text)) {
    issues.push({ level: "error", message: "EAGLE file has no <eagle> root element." });
  }
  issues.push(...validateEagleMappingsFromText(text));

  const { doc, error } = parseXml(text);
  if (error) {
    issues.push({ level: "error", message: `EAGLE XML is not well formed: ${error}` });
    return issues;
  }

  if (!doc) {
    // Server-side fallback: check that every tag is closed in order.
    const stack: string[] = [];
    const tagRe = /<\/?([A-Za-z_][\w.-]*)([^>]*?)(\/?)>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(text))) {
      const raw = m[0] as string;
      const name = m[1] as string;
      if (raw.startsWith("</")) {
        if (stack.pop() !== name) {
          issues.push({ level: "error", message: `EAGLE XML tag <${name}> closes out of order.` });
          break;
        }
      } else if (m[3] !== "/" && !raw.startsWith("<?") && !raw.startsWith("<!")) {
        stack.push(name);
      }
    }
    if (stack.length > 0) {
      issues.push({
        level: "error",
        message: `EAGLE XML has ${stack.length} unclosed tag(s), starting with <${stack[0]}>.`,
      });
    }
    return issues;
  }

  for (const tag of ["drawing", "schematic", "libraries", "parts", "sheets", "instances", "nets"]) {
    if (!doc.querySelector(tag)) {
      issues.push({ level: "error", message: `EAGLE file is missing its <${tag}> section.` });
    }
  }

  const partNames = new Set(
    Array.from(doc.querySelectorAll("parts > part"), (p) => p.getAttribute("name") ?? ""),
  );
  if (partNames.size === 0) {
    issues.push({ level: "error", message: "EAGLE file lists no parts." });
  }

  // deviceset -> gate -> symbol -> pin names, for cross-referencing.
  const gateSymbol = new Map<string, string>(); // "deviceset|gate" -> symbol
  doc.querySelectorAll("deviceset").forEach((ds) => {
    const dn = ds.getAttribute("name") ?? "";
    ds.querySelectorAll("gate").forEach((g) => {
      gateSymbol.set(`${dn}|${g.getAttribute("name")}`, g.getAttribute("symbol") ?? "");
    });
  });
  const symbolPins = new Map<string, Set<string>>();
  doc.querySelectorAll("symbols > symbol").forEach((s) => {
    symbolPins.set(
      s.getAttribute("name") ?? "",
      new Set(Array.from(s.querySelectorAll("pin"), (p) => p.getAttribute("name") ?? "")),
    );
  });
  const partDeviceset = new Map<string, string>();
  doc.querySelectorAll("parts > part").forEach((p) => {
    partDeviceset.set(p.getAttribute("name") ?? "", p.getAttribute("deviceset") ?? "");
  });

  doc.querySelectorAll("instance").forEach((inst) => {
    const part = inst.getAttribute("part") ?? "";
    const gate = inst.getAttribute("gate") ?? "";
    if (!partNames.has(part)) {
      issues.push({ level: "error", message: `EAGLE places part "${part}" that is not declared.` });
      return;
    }
    if (!gateSymbol.has(`${partDeviceset.get(part)}|${gate}`)) {
      issues.push({
        level: "error",
        message: `EAGLE part "${part}" has no gate "${gate}" in its device.`,
      });
    }
    if (inst.getAttribute("x") === null || inst.getAttribute("y") === null) {
      issues.push({ level: "error", message: `EAGLE part "${part}" has no position.` });
    }
  });

  const netEls = doc.querySelectorAll("nets > net");
  if (netEls.length === 0) {
    issues.push({ level: "warning", message: "EAGLE file contains no nets." });
  }
  netEls.forEach((net) => {
    const nn = net.getAttribute("name") ?? "";
    if (!nn) issues.push({ level: "error", message: "An EAGLE net has no name." });
    if (net.querySelectorAll("segment").length === 0) {
      issues.push({ level: "error", message: `EAGLE net "${nn}" has no segment.` });
    }
    net.querySelectorAll("pinref").forEach((ref) => {
      const part = ref.getAttribute("part") ?? "";
      const gate = ref.getAttribute("gate") ?? "";
      const pin = ref.getAttribute("pin") ?? "";
      const symName = gateSymbol.get(`${partDeviceset.get(part)}|${gate}`);
      if (!partNames.has(part)) {
        issues.push({
          level: "error",
          message: `EAGLE net "${nn}" refers to unknown part "${part}".`,
        });
        return;
      }
      if (!symName || !symbolPins.get(symName)?.has(pin)) {
        issues.push({
          level: "error",
          message: `EAGLE net "${nn}" refers to missing pin ${part}.${pin}.`,
        });
      }
    });
    if (net.querySelectorAll("wire").length === 0) {
      issues.push({ level: "warning", message: `EAGLE net "${nn}" has no drawn wire.` });
    }
  });

  return issues;
}

