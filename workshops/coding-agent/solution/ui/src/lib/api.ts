type ChatResponse = { reply: string };

export async function sendChatText(message: string): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }
  const data = (await response.json()) as ChatResponse;
  return data.reply;
}
