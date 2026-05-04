import { useEffect, useState } from "react";

type HelloResponse = { message: string };

export function App() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hello")
      .then(async (r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return (await r.json()) as HelloResponse;
      })
      .then((data) => setMessage(data.message))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Coding Agent — Solution</h1>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!error && message === null && <p>Loading…</p>}
      {message && <p>Pipeline says: <strong>{message}</strong></p>}
    </main>
  );
}
