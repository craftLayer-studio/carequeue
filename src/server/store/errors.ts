/** An error the caller should see, with the HTTP status to return. */
export class StoreError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export const notFound = (what: string) => new StoreError(404, `${what} not found`);
export const forbidden = (message = "You do not have permission to do that") => new StoreError(403, message);
