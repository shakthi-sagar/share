import { describe, expect, it } from "vitest";
import { formatSource, formatterFor } from "./format-source";

describe("source formatting", () => {
  it("recognizes common text and code file types", () => {
    expect(formatterFor("src/app.tsx")).toBe("typescript");
    expect(formatterFor("config.json")).toBe("json");
    expect(formatterFor("index.html")).toBe("html");
    expect(formatterFor("styles.css")).toBe("css");
    expect(formatterFor("notes.md")).toBe("markdown");
    expect(formatterFor("config.yaml")).toBe("yaml");
    expect(formatterFor("archive.zip")).toBe(null);
  });

  it("pretty-prints JSON without altering data", async () => {
    const text = '{"hello":[1,2],"nested":{"enabled":true}}';
    const formatted = await formatSource(text, "data.json");
    expect(JSON.parse(formatted)).toEqual(JSON.parse(text));
    expect(formatted).toContain("\n");
  });

  it("formats HTML and JavaScript for display", async () => {
    const html = await formatSource("<main><h1>Demo</h1><p>Example</p></main>", "page.html");
    expect(html).toContain("<h1>Demo</h1>");
    expect(html).toContain("\n");
    const js = await formatSource("const answer={x:1,y:2};", "script.js");
    expect(js).toContain("const answer");
    expect(js).toContain("x: 1");
  });

  it("formats CSS and YAML", async () => {
    expect(await formatSource("body{color:red;display:flex}", "style.css")).toContain(
      "color: red;",
    );
    expect(await formatSource("hello: [one,two]", "data.yaml")).toContain("hello:");
  });

  it("rejects unsupported and unbounded formatting", async () => {
    await expect(formatSource("x", "asset.zip")).rejects.toThrow("not supported");
    await expect(formatSource("x".repeat(500_001), "file.json")).rejects.toThrow("too large");
  });
});
