import { ApiError, ShareLimitError } from "@share/client";
import { ProtocolError } from "@share/protocol";

/**
 * Turns a failure from the share client into a sentence a person can act on. Messages never
 * include keys, tokens, or credentials; none of these errors carry them.
 */
export function describeShareError(error: unknown, fallback: string): string {
  if (error instanceof ShareLimitError) {
    return error.message;
  }
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Too many requests from this network. Wait a minute and try again.";
    }
    if (error.status === 413) {
      return "This snapshot is larger than this service allows.";
    }
    if (error.code === "UPLOAD_WINDOW_CLOSED" || error.code === "SHARE_EXPIRED") {
      return "The upload took too long and was stopped. Publish the snapshot again.";
    }
    if (error.status >= 500) {
      return "The share service had a problem. Try again in a moment.";
    }
    return error.message;
  }
  if (error instanceof ProtocolError) {
    if (error.code === "CHUNK_DECRYPTION_FAILED" || error.code === "INVALID_CHUNK_LENGTH") {
      return "This file failed its integrity check, so it was not decrypted.";
    }
    if (error.code === "INVALID_BASE64URL" || error.code === "INVALID_MASTER_KEY") {
      return "That is not a valid key. Check that the whole key was copied.";
    }
    return error.message;
  }
  // fetch rejects with a TypeError when the network or CORS fails before any response.
  if (error instanceof TypeError) {
    return "Could not reach the share service. Check your connection and try again.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
