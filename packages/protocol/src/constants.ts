export const PROTOCOL_VERSION = 1 as const;
export const MASTER_KEY_BYTES = 32;
export const AES_KEY_BITS = 256;
export const GCM_IV_BYTES = 12;
export const FILE_NONCE_PREFIX_BYTES = 8;
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;
export const MAX_MANIFEST_CIPHERTEXT_BYTES = 1024 * 1024;
export const MAX_CHUNK_CIPHERTEXT_BYTES = DEFAULT_CHUNK_SIZE + 16;

export const KEY_INFO = {
  manifest: "share/v1/manifest",
  readAuthorization: "share/v1/read-authorization",
  filePrefix: "share/v1/file/",
} as const;
