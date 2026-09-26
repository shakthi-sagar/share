import { describe, expect, it } from "vitest";
import { isInternalHref, isModifiedClick } from "./navigation";

const plainClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe("isInternalHref", () => {
  it("accepts same-origin paths", () => {
    expect(isInternalHref("/docs")).toBe(true);
    expect(isInternalHref("/docs/self-host#deploy")).toBe(true);
  });

  it("rejects external, protocol-relative, and missing destinations", () => {
    expect(isInternalHref("https://github.com/shakthi-sagar/share")).toBe(false);
    expect(isInternalHref("//github.com")).toBe(false);
    expect(isInternalHref("#anchor")).toBe(false);
    expect(isInternalHref(undefined)).toBe(false);
  });
});

describe("isModifiedClick", () => {
  it("routes a plain primary click", () => {
    expect(isModifiedClick(plainClick)).toBe(false);
  });

  it("leaves modified and non-primary clicks to the browser", () => {
    expect(isModifiedClick({ ...plainClick, metaKey: true })).toBe(true);
    expect(isModifiedClick({ ...plainClick, ctrlKey: true })).toBe(true);
    expect(isModifiedClick({ ...plainClick, shiftKey: true })).toBe(true);
    expect(isModifiedClick({ ...plainClick, button: 1 })).toBe(true);
  });
});
