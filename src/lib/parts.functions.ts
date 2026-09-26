import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchLibrary, type LibraryPart } from "./parts-library";

export interface PartResult extends LibraryPart {
  source: "library" | "lcsc";
  lcscUrl?: string;
}

const Input = z.object({ query: z.string().max(120) });

/** Attempt a live LCSC catalogue search; returns [] when the catalogue blocks us. */
async function liveLcsc(query: string): Promise<PartResult[]> {
  try {
    const res = await fetch("https://wmsc.lcsc.com/wmsc/search/global", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ keyword: query, currentPage: 1, pageSize: 6 }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      result?: { productSearchResultVO?: { productList?: unknown[] } };
    };
    const list = json.result?.productSearchResultVO?.productList ?? [];
    return list.slice(0, 6).map((raw) => {
      const item = raw as Record<string, unknown>;
      const code = String(item["productCode"] ?? "");
      return {
        key: `lcsc-${code}`,
        name: String(item["productModel"] ?? code),
        type: String(item["catalogName"] ?? "part").toLowerCase(),
        description: String(item["productIntroEn"] ?? ""),
        package: String(item["encapStandard"] ?? ""),
        lcsc: code,
        datasheet: String(item["pdfUrl"] ?? ""),
        keywords: [],
        pins: [],
        source: "lcsc" as const,
        lcscUrl: `https://www.lcsc.com/product-detail/${code}.html`,
      };
    });
  } catch {
    return [];
  }
}

export const searchParts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const curated: PartResult[] = searchLibrary(data.query, 8).map((part) => ({
      ...part,
      source: "library" as const,
      lcscUrl: part.lcsc
        ? `https://www.lcsc.com/product-detail/${part.lcsc}.html`
        : `https://www.lcsc.com/search?q=${encodeURIComponent(part.name)}`,
    }));

    const live = data.query.trim() ? await liveLcsc(data.query.trim()) : [];
    const seen = new Set(curated.map((c) => c.lcsc));
    const extra = live.filter((l) => l.lcsc && !seen.has(l.lcsc));

    return {
      results: [...curated, ...extra],
      liveSearch: extra.length > 0,
    };
  });

