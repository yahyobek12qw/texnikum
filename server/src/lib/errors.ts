export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: unknown) =>
  new HttpError(400, code, message, details);
export const unauthorized = (message = 'Tizimga kirish talab qilinadi', code = 'UNAUTHORIZED') =>
  new HttpError(401, code, message);
export const forbidden = (message = 'Ruxsat yo‘q', code = 'FORBIDDEN') =>
  new HttpError(403, code, message);
export const notFound = (message = 'Topilmadi', code = 'NOT_FOUND') =>
  new HttpError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT', details?: unknown) =>
  new HttpError(409, code, message, details);
export const unsupportedMedia = (message: string) => new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
export const payloadTooLarge = (message: string) => new HttpError(413, 'PAYLOAD_TOO_LARGE', message);
