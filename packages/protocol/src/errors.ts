export class ProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProtocolError";
    this.code = code;
  }
}
