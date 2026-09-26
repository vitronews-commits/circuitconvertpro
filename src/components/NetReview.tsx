import { reviewMessage } from "@/lib/recognition";
import { useState } from "react";
import type { Netlist } from "@/lib/easyeda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  netlist: Netlist;
  onChange: (next: Netlist) => void;
}

export function NetReview({ netlist, onChange }: Props) {
  const [pick, setPick] = useState<Record<string, string>>({});

  const setNets = (nets: Netlist["nets"]) => onChange({ ...netlist, nets });

  const pinOptions = netlist.components.flatMap((c) =>
    c.pins.map((p) => ({
      key: `${c.id}.${p.number}`,
      label: `${c.id}.${p.number} ${p.name}`,
      component: c.id,
      pin: p.number,
    })),
  );

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-xs uppercase tracking-widest text-primary">
          Net connections ({netlist.nets.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            let i = 1;
            while (netlist.nets.some((n) => n.name === `NET${i}`)) i += 1;
            setNets([...netlist.nets, { name: `NET${i}`, connections: [] }]);
          }}
        >
          Add net
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {netlist.nets.map((net, ni) => (
          <div key={ni} className="rounded-md border border-border bg-card/40 p-3">
            {reviewMessage(net) && <p className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">Review this net: {reviewMessage(net)}</p>}
            {net.confidence !== undefined && <p className="mb-2 text-xs text-muted-foreground">Reading confidence: {Math.round(net.confidence * 100)}% (estimate)</p>}
            <div className="flex gap-2">
              <Input
                value={net.name}
                onChange={(e) =>
                  setNets(
                    netlist.nets.map((n, i) =>
                      i === ni ? { ...n, name: e.target.value } : n,
                    ),
                  )
                }
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setNets(netlist.nets.filter((_, i) => i !== ni))}
              >
                Delete
              </Button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {net.connections.map((c, ci) => (
                <button
                  key={ci}
                  type="button"
                  onClick={() =>
                    setNets(
                      netlist.nets.map((n, i) =>
                        i === ni
                          ? {
                              ...n,
                              connections: n.connections.filter((_, k) => k !== ci),
                            }
                          : n,
                      ),
                    )
                  }
                  className="rounded-full border border-border bg-secondary px-2 py-1 font-mono text-[11px] text-secondary-foreground hover:border-destructive hover:text-destructive"
                >
                  {c.component}.{c.pin} ✕
                </button>
              ))}
              {net.connections.length === 0 && (
                <span className="text-xs text-muted-foreground">No pins on this net</span>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <Select
                value={pick[String(ni)] ?? ""}
                onValueChange={(v) => setPick((p) => ({ ...p, [String(ni)]: v }))}
              >
                <SelectTrigger className="h-9 flex-1 font-mono text-xs">
                  <SelectValue placeholder="Add a pin…" />
                </SelectTrigger>
                <SelectContent>
                  {pinOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key} className="font-mono text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const chosen = pinOptions.find((o) => o.key === pick[String(ni)]);
                  if (!chosen) return;
                  if (
                    net.connections.some(
                      (c) => c.component === chosen.component && c.pin === chosen.pin,
                    )
                  )
                    return;
                  setNets(
                    netlist.nets.map((n, i) =>
                      i === ni
                        ? {
                            ...n,
                            connections: [
                              ...n.connections,
                              { component: chosen.component, pin: chosen.pin },
                            ],
                          }
                        : n,
                    ),
                  );
                }}
              >
                Connect
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

