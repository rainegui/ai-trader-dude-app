import type { TriggerRequest } from './types';

export async function triggerAgentRun(request: TriggerRequest) {
  const res = await fetch(`${process.env.ATD_API_URL}/api/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ATD_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Agent server returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
