/** RFC 7807 problem details, as returned by an ASP.NET Core (or similar) global exception handler. */
export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  traceId?: string;
};

const STRING_FIELDS = ['type', 'title', 'detail', 'instance', 'traceId'] as const;

/** Parses a response body into problem details. Returns null for anything that is not a JSON object with known fields. */
export function parseProblemDetails(body: string | null | undefined): ProblemDetails | null {
  if (!body) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const source = parsed as Record<string, unknown>;
  const problem: ProblemDetails = {};

  for (const field of STRING_FIELDS) {
    const value = source[field];
    if (typeof value === 'string') {
      problem[field] = value;
    }
  }
  if (typeof source.status === 'number') {
    problem.status = source.status;
  }

  return Object.keys(problem).length > 0 ? problem : null;
}
