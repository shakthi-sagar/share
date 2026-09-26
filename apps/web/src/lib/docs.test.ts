import { describe, expect, it } from "vitest";
import { docsHref, docsPages, findDocsPage, normalizeDocsSlug } from "./docs";

describe("docs index", () => {
  it("keeps slugs unique and filesystem safe", () => {
    const slugs = docsPages.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    }
  });

  it("builds routes from the slug", () => {
    expect(docsHref("")).toBe("/docs");
    expect(docsHref("self-host")).toBe("/docs/self-host");
  });

  it("finds a page and reports unknown slugs", () => {
    expect(findDocsPage("security")?.title).toBe("Security model");
    expect(findDocsPage("nope")).toBeNull();
  });

  it("normalizes request paths into slugs", () => {
    expect(normalizeDocsSlug("")).toBe("");
    expect(normalizeDocsSlug("/")).toBe("");
    expect(normalizeDocsSlug("self-host")).toBe("self-host");
    expect(normalizeDocsSlug("/Self-Host/")).toBe("self-host");
  });
});
