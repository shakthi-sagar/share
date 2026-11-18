import { describe, expect, it } from "vitest";
import { resolveHtmlReference } from "./html-assets";

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
