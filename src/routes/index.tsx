import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { convertSchematic } from "@/lib/schematic.functions";
import { type Netlist } from "@/lib/easyeda";
import {
  verifyExports,
  downloadText,
  fileNameFor,
  type FormatExport,
} from "@/lib/verify";
import type { Issue } from "@/lib/validate";
import { downloadPackage } from "@/lib/export-package";
import { getProject, saveProject } from "@/lib/saved-projects";
import { ComponentEditor } from "@/components/ComponentEditor";
import { NetReview } from "@/components/NetReview";
import { SchematicPreview } from "@/components/SchematicPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { project?: string } => {
    const p = search["project"];
    return typeof p === "string" ? { project: p } : {};
  },

  head: () => ({
    meta: [
      { title: "Circuit Image to EasyEDA, KiCad & EAGLE Converter" },
      {
        name: "description",
        content:
          "Upload a photo or scan of a circuit diagram and get verified EasyEDA JSON, KiCad and EAGLE schematic files with components, pins and nets.",
      },
      {
        property: "og:title",
        content: "Circuit Image to EasyEDA, KiCad & EAGLE Converter",
      },
      {
        property: "og:description",
        content:
          "Turn any circuit diagram image into schematic files for EasyEDA, KiCad and EAGLE — each one verified before download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const convert = useServerFn(convertSchematic);
  const { project: projectId } = Route.useSearch();
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [netlist, setNetlist] = useState<Netlist | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const found = getProject(projectId);
    if (!found) return;
    setNetlist(found.netlist);
    setImage(found.image ?? null);
    setSavedId(found.id);
  }, [projectId]);

  const mutation = useMutation({
    mutationFn: (vars: { imageDataUrl: string; hint: string }) =>
      convert({ data: vars }),
    onSuccess: (data) => {
      setNetlist(data.netlist as Netlist);
      setSavedId(null);
      setSavedAt(null);
    },
  });

  const save = () => {
    if (!netlist) return;
    const saved = saveProject({
      ...(savedId ? { id: savedId } : {}),
      name: netlist.title ?? "Untitled schematic",
      netlist,
      image,
    });
    setSavedId(saved.id);
    setSavedAt(saved.savedAt);
  };


  const onFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      mutation.reset();
      setNetlist(null);
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const verification = useMemo(
    () => (netlist ? verifyExports(netlist) : null),
    [netlist],
  );
  const easyeda = verification?.easyedaDoc ?? null;
  const [openFormat, setOpenFormat] = useState<string | null>(null);
  const allOk = Boolean(verification?.formats.some((f: FormatExport) => f.ok));




  return (
    <main className="min-h-screen bg-background bg-blueprint text-foreground">
      <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-5 sm:py-10">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
            circuit vision
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
            Schematic image → EasyEDA, KiCad, EAGLE
          </h1>
          <Link to="/saved" className="mt-2 inline-block font-mono text-xs text-primary underline">
            My saved schematics →
          </Link>

          <p className="mt-3 text-sm text-muted-foreground">
            Drop a photo, scan or screenshot of a circuit diagram. It is read into a
            netlist, placed on a grid with routed wires, and written out as schematic
            files for EasyEDA, KiCad and EAGLE — each checked before you can download it.
          </p>
        </header>

        <section className="panel p-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {netlist && (
            <div className="mb-4">
              <label htmlFor="project-title" className="mb-2 block font-mono text-[11px] uppercase text-muted-foreground">Project title</label>
              <Input
                id="project-title"
                value={netlist.title ?? ""}
                onChange={(event) => setNetlist({ ...netlist, title: event.target.value })}
                className="text-lg font-semibold"
                placeholder="Untitled schematic"
              />
            </div>
          )}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0]);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-card/40 px-4 py-10 text-center transition-colors hover:border-primary/70"
          >
            {image ? (
              <img
                src={image}
                alt="Uploaded circuit schematic diagram"
                className="max-h-72 w-auto rounded-md border border-border"
              />
            ) : (
              <>
                <span className="font-mono text-sm text-primary">[ + ]</span>
                <span className="mt-2 text-sm text-muted-foreground">
                  Tap to choose an image, or drop one here
                </span>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={!image || mutation.isPending}
              onClick={() =>
                image &&
                mutation.mutate({ imageDataUrl: image, hint: "" })
              }
            >
              {mutation.isPending ? "Tracing circuit…" : "Convert to EasyEDA"}
            </Button>
            {image && (
              <Button
                variant="outline"
                onClick={() => {
                  setImage(null);
                  mutation.reset();
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {mutation.isError && (
            <p className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {(mutation.error as Error).message}
            </p>
          )}
        </section>

        {netlist && easyeda && (
          <section className="mt-8 space-y-6">
            <div className="panel p-5">
              {netlist.notes && (
                <p className="mt-1 text-sm text-muted-foreground">{netlist.notes}</p>
              )}
              <p className="font-mono text-xs text-muted-foreground">
                {netlist.components.length} components · {netlist.nets.length} nets
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={save}>
                  {savedId ? "Update saved project" : "Save to my projects"}
                </Button>
                {savedAt && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    saved {new Date(savedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>


            <ComponentEditor netlist={netlist} onChange={setNetlist} />

            <NetReview netlist={netlist} onChange={setNetlist} />

            {verification && (
              <div className="panel p-5">
                <h3 className="font-mono text-xs uppercase tracking-widest text-primary">
                  Export verification
                </h3>

                <div className="mt-3 flex items-start gap-3 rounded-md border border-border/60 bg-card/40 p-3">
                  <span
                    className={`mt-[2px] font-mono text-sm ${verification.circuit.ok ? "text-primary" : "text-destructive"}`}
                  >
                    {verification.circuit.ok ? "[OK]" : "[!]"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Circuit logic</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      designators, pin numbers, net references
                      {verification.circuit.errors > 0 &&
                        ` · ${verification.circuit.errors} error${verification.circuit.errors === 1 ? "" : "s"}`}
                      {verification.circuit.warnings > 0 &&
                        ` · ${verification.circuit.warnings} warning${verification.circuit.warnings === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-3">
                  {verification.formats.map((f: FormatExport) => (
                    <li
                      key={f.key}
                      className="rounded-md border border-border/60 bg-card/40 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`mt-[2px] font-mono text-sm ${f.ok ? "text-primary" : "text-destructive"}`}
                          >
                            {f.ok ? "[OK]" : "[!]"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {f.label}{" "}
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {f.extension}
                              </span>
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              verified: {f.checks}
                            </p>
                            <p
                              className={`font-mono text-[11px] ${f.ok ? "text-muted-foreground" : "text-destructive"}`}
                            >
                              {f.ok
                                ? `passed${f.warnings ? ` · ${f.warnings} warning${f.warnings === 1 ? "" : "s"}` : ""}`
                                : `${f.errors} error${f.errors === 1 ? "" : "s"} — download blocked`}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {f.issues.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setOpenFormat(openFormat === f.key ? null : f.key)
                              }
                            >
                              {openFormat === f.key ? "Hide" : "Details"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={f.key === "easyeda" ? "default" : "outline"}
                            disabled={!f.ok}
                            title={f.ok ? f.target : "This file did not pass verification."}
                            onClick={() =>
                              downloadText(fileNameFor(netlist, f), f.mime, f.text)
                            }
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                      {openFormat === f.key && f.issues.length > 0 && (
                        <ul className="mt-3 max-h-52 space-y-1 overflow-auto font-mono text-[11px]">
                          {f.issues.map((i: Issue, k: number) => (
                            <li
                              key={k}
                              className={
                                i.level === "error"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }
                            >
                              [{i.level}] {i.message}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(f.key === "kicad" || f.key === "eagle") && (
                        <SchematicPreview netlist={netlist} format={f.key} />
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    disabled={!allOk || !easyeda}
                    onClick={() => easyeda && downloadPackage(netlist, easyeda, image)}
                  >
                    Download verified package (.zip)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigator.clipboard.writeText(JSON.stringify(easyeda))
                    }
                  >
                    Copy EasyEDA JSON
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Each file is generated and checked with its own rules; a download only
                  unlocks when that file passes. The package holds every verified file plus
                  the netlist, parts list, net list, source image and the full report.
                </p>
              </div>
            )}

            <div className="panel p-5">
              <h3 className="font-mono text-xs uppercase tracking-widest text-primary">
                Output preview
              </h3>
              <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-card/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {JSON.stringify(easyeda, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

