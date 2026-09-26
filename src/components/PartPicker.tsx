import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { searchParts, type PartResult } from "@/lib/parts.functions";
import type { NetlistComponent } from "@/lib/easyeda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  component: NetlistComponent;
  onApply: (patch: Partial<NetlistComponent>) => void;
}

export function PartPicker({ component, onApply }: Props) {
  const run = useServerFn(searchParts);
  const [query, setQuery] = useState(component.value ?? component.type ?? "");
  const [results, setResults] = useState<PartResult[]>([]);

  const search = useMutation({
    mutationFn: (q: string) => run({ data: { query: q } }),
    onSuccess: (data) => setResults(data.results as PartResult[]),
  });

  return (
    <div className="rounded-lg border border-border/70 bg-card/30 p-3">
      <h4 className="font-mono text-[11px] uppercase tracking-widest text-primary">
        Match a real part
      </h4>
      <div className="mt-2 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search.mutate(query)}
          placeholder="NE555, 2N3904, 10k…"
          className="h-8 bg-card/40 font-mono text-xs"
        />
        <Button size="sm" disabled={search.isPending} onClick={() => search.mutate(query)}>
          {search.isPending ? "…" : "Search"}
        </Button>
      </div>

      {search.isError && (
        <p className="mt-2 text-xs text-destructive">
          {(search.error as Error).message}
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 max-h-56 space-y-2 overflow-auto">
          {results.map((r) => (
            <li key={r.key} className="rounded border border-border/60 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{r.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {r.description}
                    {r.package ? ` · ${r.package}` : ""}
                    {r.pins.length ? ` · ${r.pins.length} pins` : ""}
                  </p>
                  <div className="mt-1 flex gap-3 font-mono text-[10px]">
                    {r.lcsc && (
                      <a
                        href={r.lcscUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        LCSC {r.lcsc}
                      </a>
                    )}
                    {r.datasheet && (
                      <a
                        href={r.datasheet}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Datasheet
                      </a>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={r.pins.length === 0}
                  onClick={() =>
                    onApply({
                      type: r.type,
                      value: r.name,
                      pins: r.pins.map((p) => ({ ...p })),
                    })
                  }
                >
                  Use
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        “Use” replaces this part’s pins with the datasheet pinout.
      </p>
    </div>
  );
}

