// Admin-panel fetch helper: injects the password header, parses JSON,
// and throws an Error with the server's message on non-2xx responses.
export async function apiFetch(path, { password, body, headers, ...opts } = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(password ? { password } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body (e.g. 204)
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}
