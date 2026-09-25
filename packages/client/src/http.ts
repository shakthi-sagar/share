export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/u, "")}${path}`;
}

export async function requireOk(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  let code = "API_ERROR";
  let message = `API request failed with status ${response.status}`;
  try {
    const payload: unknown = await response.json();
    if (isErrorPayload(payload)) {
      code = payload.error.code;
      message = payload.error.message;
    }
  } catch {
    // Preserve the generic error when the server does not return JSON.
  }
  throw new ApiError(response.status, code, message);
}

function isErrorPayload(value: unknown): value is { error: { code: string; message: string } } {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return false;
  }
  const error = value.error;
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}
