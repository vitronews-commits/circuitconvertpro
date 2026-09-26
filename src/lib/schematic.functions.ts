import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { netlistToEasyEda } from "./easyeda";
import { SYSTEM, VERIFY, JSON_SCHEMA, normalizeRecognition, applyLibrary } from "./recognition";

const InputSchema = z.object({
  imageDataUrl: z.string().min(20),
  hint: z.string().max(500).optional(),
});

type Content =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function askGateway(key: string, system: string, content: Content[]) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429)
      throw new Error("Too many requests right now — please retry in a moment.");
    if (res.status === 402)
      throw new Error("AI credits are exhausted. Add credits in Lovable to continue.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error("Could not read a netlist from that image. Try a clearer photo.");
  }
}

export const convertSchematic = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const first = await askGateway(key, SYSTEM, [
      {
        type: "text",
        text: `Extract the netlist from this schematic image.${data.hint ? ` User notes: ${data.hint}` : ""}`,
      },
      { type: "image_url", image_url: { url: data.imageDataUrl } },
    ]);

    let netlist = normalizeRecognition(first);

    // Second pass: re-check the extracted netlist against the image.
    try {
      const checked = await askGateway(key, VERIFY, [
        {
          type: "text",
          text: `Netlist to verify:\n${JSON.stringify(netlist)}${data.hint ? `\nUser notes: ${data.hint}` : ""}`,
        },
        { type: "image_url", image_url: { url: data.imageDataUrl } },
      ]);
      const parsed = normalizeRecognition(checked);
      if (!parsed.components.length) throw new Error("Empty verification result");
      const title = netlist.title ?? parsed.title;
      netlist = { ...parsed, ...(title ? { title } : {}) };
    } catch {
      // Keep usable extraction, but never imply the verification succeeded.
      netlist = { ...netlist, notes: [netlist.notes, "Automatic second-pass verification did not complete. Manually review all components and connections before export."].filter(Boolean).join("\n") };
    }

    netlist = applyLibrary(netlist);

    if (!netlist.title?.trim()) {
      const lead = netlist.components.find((c) => c.type === "ic") ?? netlist.components[0];
      netlist = {
        ...netlist,
        title: lead?.part
          ? `${lead.part} circuit`
          : `Circuit with ${netlist.components.length} parts`,
      };
    }


    return {
      netlist,
      easyeda: netlistToEasyEda(netlist),
    };
  });

