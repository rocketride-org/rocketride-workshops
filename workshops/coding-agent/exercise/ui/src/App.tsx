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
      <h1>Coding Agent — Exercise</h1>
      <p>
        This is the workshop scaffold. Implement <code>run_hello()</code> in{" "}
        <code>api/app/pipelines/sdk/hello_client.py</code> and wire it into{" "}
        <code>api/app/main.py</code>.
      </p>
      {error && <p style={{ color: "crimson" }}>API error: {error}</p>}
      {!error && message === null && <p>Waiting for /api/hello…</p>}
      {message && (
        <p>
          Pipeline says: <strong>{message}</strong>
        </p>
      )}
    </main>
  );
}
