import { ApiError, ShareLimitError } from "@share/client";
import { ProtocolError } from "@share/protocol";
import { describe, expect, it } from "vitest";
import { describeShareError } from "./errors";

describe("share error messages", () => {
  it("explains rate limits, size limits, and closed uploads", () => {
    expect(describeShareError(new ApiError(429, "RATE_LIMITED", "x"), "f")).toMatch(
      /wait a minute/iu,
    );
    expect(describeShareError(new ApiError(413, "SHARE_TOO_LARGE", "x"), "f")).toMatch(/larger/iu);
    expect(describeShareError(new ApiError(410, "UPLOAD_WINDOW_CLOSED", "x"), "f")).toMatch(
      /publish the snapshot again/iu,
    );
    expect(describeShareError(new ApiError(500, "INTERNAL_ERROR", "x"), "f")).toMatch(/problem/iu);
  });

  it("explains network, key, and integrity failures", () => {
    expect(describeShareError(new TypeError("Failed to fetch"), "f")).toMatch(/could not reach/iu);
    expect(describeShareError(new ProtocolError("INVALID_MASTER_KEY", "x"), "f")).toMatch(
      /not a valid key/iu,
    );
    expect(describeShareError(new ProtocolError("CHUNK_DECRYPTION_FAILED", "x"), "f")).toMatch(
      /integrity/iu,
    );
  });

  it("passes through limit messages and falls back for unknown values", () => {
    expect(describeShareError(new ShareLimitError("NO_FILES", "Add a file"), "f")).toBe(
      "Add a file",
    );
    expect(describeShareError("nope", "Fallback")).toBe("Fallback");
  });
});
