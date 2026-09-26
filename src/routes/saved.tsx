import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  deleteProject,
  listProjects,
  renameProject,
  type SavedProject,
} from "@/lib/saved-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved Schematics — Circuit Vision" },
      {
        name: "description",
        content:
          "Reopen circuit diagrams you already converted, rename them, or remove them from this device.",
      },
      { property: "og:title", content: "Saved Schematics — Circuit Vision" },
      {
        property: "og:description",
        content: "Your converted circuit diagrams, stored on this device and ready to reopen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => setProjects(listProjects()), []);

  return (
    <main className="min-h-screen bg-background bg-blueprint text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
            circuit vision
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Saved schematics</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Stored in this browser on this device. Clearing browsing data removes them.
          </p>
          <Link to="/" className="mt-4 inline-block font-mono text-xs text-primary underline">
            ← Convert a new image
          </Link>
        </header>

        {projects.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Nothing saved yet. Convert a diagram, then press “Save to my projects”.
          </div>
        ) : (
          <ul className="space-y-4">
            {projects.map((p) => (
              <li key={p.id} className="panel flex items-center gap-4 p-4">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={`${p.name} circuit diagram thumbnail`}
                    loading="lazy"
                    className="h-16 w-20 rounded border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-20 items-center justify-center rounded border border-border font-mono text-xs text-muted-foreground">
                    no img
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {editing === p.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="h-8 bg-card/40 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          renameProject(p.id, draft || p.name);
                          setEditing(null);
                          setProjects(listProjects());
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ) : (
                    <p className="truncate font-medium">{p.name}</p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {p.netlist.components.length} parts · {p.netlist.nets.length} nets ·{" "}
                    {new Date(p.savedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/", search: { project: p.id } })}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(p.id);
                      setDraft(p.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      deleteProject(p.id);
                      setProjects(listProjects());
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

