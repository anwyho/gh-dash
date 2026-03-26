// Shared SWR fetcher — throws on non-OK so SWR correctly sets `error`
export async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    throw err;
  }
  return res.json();
}
