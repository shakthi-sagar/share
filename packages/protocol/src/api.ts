import { z } from "zod";
import { PROTOCOL_VERSION } from "./constants";

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
  objectCount: z.number().int().nonnegative().max(10_000),
  chunkCount: z.number().int().nonnegative().max(1_000_000),
  ciphertextBytes: z.number().int().nonnegative().safe(),
});

export type CreateShareRequest = z.infer<typeof createShareRequestSchema>;
export type CreateShareResponse = z.infer<typeof createShareResponseSchema>;
export type CompleteShareRequest = z.infer<typeof completeShareRequestSchema>;
