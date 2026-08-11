import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from "@/lib/admin-auth";

// TOLS Staging API Configuration
const TOLS_BASE_URL = (process.env.TOLS_BASE_URL || 'https://tolscrypto.base44.app/api').replace(/\/$/, '');
const TOLS_API_KEY = process.env.TOLS_API_KEY || '';
const TOLS_APP_KEY = process.env.TOLS_APP_KEY || '';

function buildHeaders(clientApiKey?: string, clientAppKey?: string): Record<string, string> {
  const apiKey = clientApiKey || TOLS_API_KEY;
  const appKey = clientAppKey || TOLS_APP_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
    headers['api_key'] = apiKey;
  }
  if (appKey) {
    headers['x-app-key'] = appKey;
    headers['app_key'] = appKey;
  }
  return headers;
}

function getClientKeys(searchParams: URLSearchParams): { apiKey?: string; appKey?: string } {
  return {
    apiKey: searchParams.get('api_key') || undefined,
    appKey: searchParams.get('app_key') || undefined,
  };
}

function buildTargetUrl(path: string, searchParams: URLSearchParams): string {
  const url = new URL(`${TOLS_BASE_URL}${path}`);
  const internalParams = new Set(['path', 'api_key', 'app_key', '_test']);
  searchParams.forEach((value, key) => {
    if (!internalParams.has(key)) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

/** Safely parse response body — handles both JSON and plain text */
async function parseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (contentType.includes('application/json')) {
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }
  return { httpStatus: res.status, body: text, contentType };
}

function makeError(status: number, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: message, ...details }, { status });
}

/**
 * Interpret upstream HTTP status codes and return a friendly error.
 * The TOLS staging API returns 404 for:
 *   - Invalid/missing credentials (instead of 401)
 *   - Unknown entity paths
 *   - Unauthorized access
 */
function interpretUpstreamError(status: number, body: unknown, path: string): NextResponse {
  const bodyStr = String(
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).body || (body as Record<string, unknown>).raw || JSON.stringify(body)
      : body
  );

  if (status === 401 || status === 403) {
    return makeError(status, 'Authentication failed. Check your API Key and App Key.', {
      upstream_status: status,
      path,
      hint: 'The TOLS API rejected your credentials. Please verify them in Settings.',
    });
  }

  if (status === 404) {
    // Distinguish between "API is alive but path doesn't exist" vs "credentials are wrong"
    if (bodyStr === '404 page not found' || bodyStr.includes('404')) {
      return makeError(404, 'API endpoint not found or invalid credentials.', {
        upstream_status: 404,
        path,
        hint: 'The TOLS staging API returned 404. This usually means either the API path has changed, or your API Key / App Key are not valid for this endpoint. Verify your credentials in Settings or check the API documentation.',
      });
    }
    return makeError(404, 'Resource not found.', {
      upstream_status: 404,
      path,
    });
  }

  if (status === 429) {
    return makeError(429, 'Rate limited by TOLS API. Please wait and retry.', {
      upstream_status: 429,
      path,
      hint: 'Too many requests. The API is throttling your requests.',
    });
  }

  if (status >= 500) {
    return makeError(502, `TOLS API server error (HTTP ${status}).`, {
      upstream_status: status,
      path,
      hint: 'The TOLS staging API is experiencing a server error. Try again later.',
    });
  }

  // For other non-2xx status codes, forward with context
  return makeError(status, `API returned status ${status}.`, {
    upstream_status: status,
    upstream_body: bodyStr,
    path,
  });
}

/** GET handler with connection-test support */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';
  const { apiKey, appKey } = getClientKeys(searchParams);
  const isHealthCheck = searchParams.get('entity') === 'health';

  // Health check endpoint — just verify our proxy is alive
  if (isHealthCheck && !path) {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // Connection test mode: /api/tols?path=/&api_key=...&app_key=...&_test=true
  const isTest = searchParams.get('_test') === 'true';

  try {
    const targetPath = isTest && !path ? '/' : path;
    const url = buildTargetUrl(targetPath, searchParams);
    const headers = buildHeaders(apiKey, appKey);

    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const data = await parseBody(res);

    // For connection test, return diagnostic info
    if (isTest) {
      return NextResponse.json({
        success: res.ok,
        status: res.status,
        upstream_url: url.replace(/(api_key|app_key)=[^&]+/g, '$1=***'),
        response: data,
        timestamp: new Date().toISOString(),
      });
    }

    // If upstream returned an error, return a friendly interpretation
    if (!res.ok) {
      return interpretUpstreamError(res.status, data, path);
    }

    // Forward successful responses
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return makeError(500, `Proxy Error: ${message}`, {
      target_base: TOLS_BASE_URL,
      path,
      hint: 'Could not reach the TOLS API. Check the base URL and network connectivity.',
    });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';
  const { apiKey, appKey } = getClientKeys(searchParams);
  const body = await request.json();

  try {
    const url = buildTargetUrl(path, searchParams);
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(apiKey, appKey),
      body: JSON.stringify(body),
    });
    const data = await parseBody(res);

    if (!res.ok) {
      return interpretUpstreamError(res.status, data, path);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return makeError(500, `Proxy Error: ${message}`, {
      target_base: TOLS_BASE_URL,
      path,
    });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';
  const { apiKey, appKey } = getClientKeys(searchParams);
  const body = await request.json();

  try {
    const url = buildTargetUrl(path, searchParams);
    const res = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(apiKey, appKey),
      body: JSON.stringify(body),
    });
    const data = await parseBody(res);

    if (!res.ok) {
      return interpretUpstreamError(res.status, data, path);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return makeError(500, `Proxy Error: ${message}`, {
      target_base: TOLS_BASE_URL,
      path,
    });
  }
}

export async function HEAD() {
  return NextResponse.json({ status: 'ok' });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';
  const { apiKey, appKey } = getClientKeys(searchParams);

  try {
    const url = buildTargetUrl(path, searchParams);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(apiKey, appKey),
    });
    const data = await parseBody(res);

    if (!res.ok) {
      return interpretUpstreamError(res.status, data, path);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return makeError(500, `Proxy Error: ${message}`, {
      target_base: TOLS_BASE_URL,
      path,
    });
  }
}
