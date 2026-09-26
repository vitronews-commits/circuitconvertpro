import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComponentEditor } from "../src/components/ComponentEditor";
import { NetReview } from "../src/components/NetReview";
import type { Netlist } from "../src/lib/easyeda";

test("both editing views surface uncertain readings without hiding editable data", () => {
  const netlist: Netlist = {
    components: [{ id: "R1", type: "resistor", value: "unknown", confidence: 0.4, reviewReason: "Handwritten value is unclear", pins: [{ number: "1", name: "1" }, { number: "2", name: "2" }] }],
    nets: [{ name: "NET1", confidence: 0.3, reviewReason: "Junction dot is unclear", connections: [{ component: "R1", pin: "1" }] }],
  };
  const components = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ComponentEditor netlist={netlist} onChange={() => {}} /></QueryClientProvider>);
  expect(components).toContain("Check uncertain components");
  expect(components).toContain("Handwritten value is unclear");
  expect(components).toContain('value="unknown"');
  const nets = renderToStaticMarkup(<NetReview netlist={netlist} onChange={() => {}} />);
  expect(nets).toContain("Junction dot is unclear");
  expect(nets).toContain("R1.1");
});
