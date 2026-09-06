/**
 * Safe fetch utility that inspects Content-Type and response status
 * before attempting JSON parsing, completely eliminating
 * "Unexpected token '<', '<!doctype '... is not valid JSON" errors.
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';

    // Check if the response is actually JSON
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      return {
        ok: false,
        status: res.status,
        error: res.ok
          ? 'Server returned non-JSON response'
          : `Server returned HTTP ${res.status}: ${text.slice(0, 120)}`
      };
    }

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.error || `Request failed with status ${res.status}`,
        data
      };
    }

    return {
      ok: true,
      status: res.status,
      data
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Network request failed'
    };
  }
}
