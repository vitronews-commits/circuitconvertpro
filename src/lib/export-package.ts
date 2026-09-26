import { zipSync, strToU8 } from "fflate";
import type { Netlist, EasyEdaDoc } from "./easyeda";
import { verifyExports, type FormatExport } from "./verify";
import { type Issue } from "./validate";

const slug = (s: string) => s.replace(/\W+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "schematic";

function bomCsv(netlist: Netlist) {
  const rows = [["Designator", "Type", "Value", "Pins"]];
  netlist.components.forEach((c) =>
    rows.push([c.id, c.type, c.value ?? "", String(c.pins.length)]),
  );
  return rows
    .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function netsCsv(netlist: Netlist) {
  const rows = [["Net", "Connections"]];
  netlist.nets.forEach((n) =>
    rows.push([n.name, n.connections.map((c) => `${c.component}.${c.pin}`).join(" ")]),
  );
  return rows
    .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function report(issues: Issue[]) {
  if (issues.length === 0) return "No issues found.";
  return issues.map((i) => `[${i.level.toUpperCase()}] ${i.message}`).join("\n");
}

export function downloadPackage(
  netlist: Netlist,
  _easyeda: EasyEdaDoc,
  imageDataUrl?: string | null,
) {
  const name = slug(netlist.title ?? "schematic");
  const v = verifyExports(netlist);

  const files: Record<string, Uint8Array> = {
    "netlist.json": strToU8(JSON.stringify(netlist, null, 2)),
    "bom.csv": strToU8(bomCsv(netlist)),
    "nets.csv": strToU8(netsCsv(netlist)),
  };

  // Only verified files go into the package.
  const included: string[] = [];
  const skipped: string[] = [];
  const lines: string[] = [
    netlist.title ?? "Imported schematic",
    "",
    "Circuit check:",
    report(v.circuit.issues),
    "",
  ];
  v.formats.forEach((f: FormatExport) => {
    const fileName = `${name}${f.extension}`;
    lines.push(`${f.label} (${fileName}) — ${f.ok ? "VERIFIED" : "REJECTED"}`);
    lines.push(`  checked: ${f.checks}`);
    lines.push(`  ${report(f.issues).split("\n").join("\n  ")}`);
    lines.push("");
    if (f.ok) {
      files[fileName] = strToU8(f.text);
      included.push(`- ${fileName}  ${f.target}`);
    } else {
      skipped.push(`- ${fileName} (${f.errors} error${f.errors === 1 ? "" : "s"})`);
    }
  });

  files["verification-report.txt"] = strToU8(lines.join("\n"));
  files["README.txt"] = strToU8(
    [
      netlist.title ?? "Imported schematic",
      "",
      "Verified files in this package:",
      ...(included.length ? included : ["- (none passed verification)"]),
      ...(skipped.length ? ["", "Left out because verification failed:", ...skipped] : []),
      "",
      "- netlist.json              editable netlist used to build every file",
      "- bom.csv                   component list",
      "- nets.csv                  net connection list",
      "- verification-report.txt   every check run before export",
      "",
      "Always review the netlist before manufacturing.",
    ].join("\n"),
  );

  if (imageDataUrl?.startsWith("data:image/")) {
    const [meta, b64] = imageDataUrl.split(",");
    if (b64) {
      const ext = meta?.includes("png") ? "png" : meta?.includes("webp") ? "webp" : "jpg";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      files[`source.${ext}`] = bytes;
    }
  }

  const zipped = zipSync(files, { level: 6 });
  const buffer = new Uint8Array(zipped).slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.download = `${name}-easyeda-package.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


