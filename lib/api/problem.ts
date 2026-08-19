export type ApiErrorDetail = {
  field?: string;
  reason: string;
  message: string;
};

export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: readonly ApiErrorDetail[],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiProblem";
  }
}
