import { describe, expect, it } from "vitest";
import { parseSrcset, resolveHtmlReference, rewriteCssAssets } from "./html-assets";

describe("relative HTML asset paths", () => {
  it("resolves sibling files relative to the HTML document in a share", () => {
    expect(resolveHtmlReference("chamber/index.html", "chamber.png")).toBe("chamber/chamber.png");
    expect(resolveHtmlReference("chamber/index.html", "./seating.png")).toBe("chamber/seating.png");
    expect(resolveHtmlReference("chamber/pages/review.html", "../images/cast.png")).toBe(
      "chamber/images/cast.png",
    );
  });
  it("strips query and fragment and decodes safe URL paths", () => {
    expect(resolveHtmlReference("project/index.html", "scene%201.png?v=1#top")).toBe(
      "project/scene 1.png",
    );
  });
  it("never resolves external, absolute, script, or data URLs", () => {
    for (const value of [
      "https://evil.example/asset.png",
      "//evil.example/a.png",
      "data:image/png,123",
      "javascript:alert(1)",
      "/admin",
      "#section",
    ]) {
      expect(resolveHtmlReference("bundle/index.html", value)).toBeNull();
    }
  });
});

describe("HTML bundle resource rewriting", () => {
  it("preserves descriptors and commas inside URL tokens", () => {
    expect(parseSrcset("small.png, large.png 2x, /third.png 480w, images/a,b.png 3x")).toEqual([
      { url: "small.png", descriptor: "" },
      { url: "large.png", descriptor: "2x" },
      { url: "/third.png", descriptor: "480w" },
      { url: "images/a,b.png", descriptor: "3x" },
    ]);
  });

  it("resolves CSS resources from the stylesheet and ignores strings and comments", async () => {
    const css =
      "/* url(skip.svg) */p{content:'url(skip.svg)';background:url('../img/a.svg');mask:url(https://external.invalid/mask.svg)}";
    const load = async (ref: string, from: string) => {
      const path = resolveHtmlReference(from, ref);
      return path ? `blob:${path}` : null;
    };
    expect(await rewriteCssAssets(css, "site/css/style.css", load)).toBe(
      `/* url(skip.svg) */p{content:'url(skip.svg)';background:url("blob:site/img/a.svg");mask:url("")}`,
    );
  });
});
