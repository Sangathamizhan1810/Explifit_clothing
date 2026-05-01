const API = 'https://explifit-clothing.onrender.com';

export async function post(url, body = {}) {
  const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

export async function get(url) {
  const r = await fetch(`${API}${url}`);
  return r.json();
}

export async function put(url, body = {}) {
  const r = await fetch(`${API}${url}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

export async function del(url) {
  const r = await fetch(`${API}${url}`, { method: 'DELETE' });
  return r.json();
}

export async function uploadFile(url, formData) {
  const r = await fetch(`${API}${url}`, { method: 'POST', body: formData });
  return r.json();
}

export function imageUrl(path) {
  return `${API}${path}`;
}
