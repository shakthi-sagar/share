import { apiUrl, requireOk } from "./http";

export async function deleteEncryptedShare(
  apiBaseUrl: string,
  id: string,
  deleteToken: string,
  request: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> {
  await requireOk(
    await request(apiUrl(apiBaseUrl, `/v1/shares/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Delete ${deleteToken}` },
    }),
  );
}
