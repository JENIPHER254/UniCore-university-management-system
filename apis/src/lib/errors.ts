/** Application error with an HTTP status; thrown by services, handled centrally. */
export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, string>) =>
  new ApiError(400, message, details);

export const unauthorized = (message = "Authentication required") => new ApiError(401, message);

export const forbidden = (message = "You do not have permission to perform this action") =>
  new ApiError(403, message);

export const notFound = (message = "Resource not found") => new ApiError(404, message);

export const conflict = (message: string, details?: Record<string, string>) =>
  new ApiError(409, message, details);
