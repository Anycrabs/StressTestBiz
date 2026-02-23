const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function withAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || body.message || JSON.stringify(body));
  }
  return body;
}

export async function register(email, password) {
  return request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function me(token) {
  return request("/auth/me", {
    headers: withAuthHeaders(token),
  });
}

export async function uploadFile(file, token) {
  const form = new FormData();
  form.append("file", file);
  return request("/upload", {
    method: "POST",
    headers: withAuthHeaders(token),
    body: form,
  });
}

export async function runScenario(payload, token) {
  return request("/scenario/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export async function getScenarioResult(scenarioId, token) {
  return request(`/scenario/result/${scenarioId}`, {
    headers: withAuthHeaders(token),
  });
}

export async function listScenarios(token) {
  return request("/scenario/list", {
    headers: withAuthHeaders(token),
  });
}

export { API_BASE_URL };
