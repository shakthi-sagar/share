import { z } from "zod";
import { MAX_MANIFEST_FILES, MAX_SHARE_CHUNKS, PROTOCOL_VERSION } from "./constants";

export const shareIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const credentialHashSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const createShareRequestSchema = z.object({
  expiresInSeconds: z.number().int().positive().max(31_536_000).nullable(),
});

export const createShareResponseSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  id: shareIdSchema,
  uploadToken: tokenSchema,
  deleteToken: tokenSchema,
  expiresAt: z.string().datetime().nullable(),
});

export const completeShareRequestSchema = z.object({
  accessCredentialHash: credentialHashSchema,
  objectCount: z.number().int().nonnegative().max(MAX_MANIFEST_FILES),
  chunkCount: z.number().int().nonnegative().max(MAX_SHARE_CHUNKS),
  ciphertextBytes: z.number().int().nonnegative().safe(),
});

export type CreateShareRequest = z.infer<typeof createShareRequestSchema>;
export type CreateShareResponse = z.infer<typeof createShareResponseSchema>;
export type CompleteShareRequest = z.infer<typeof completeShareRequestSchema>;
