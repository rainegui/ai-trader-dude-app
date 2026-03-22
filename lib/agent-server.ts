import type { TriggerRequest } from './types';

const API_URL = () => process.env.ATD_API_URL;
const API_TOKEN = () => process.env.ATD_API_TOKEN;

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${API_TOKEN()}`,
    'Content-Type': 'application/json',
  };
}

export async function triggerAgentRun(request: TriggerRequest) {
  const url = API_URL();
  if (!url) throw new Error('ATD_API_URL is not configured');

  const res = await fetch(`${url}/api/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Agent server returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function triggerFullCycle(cycle?: string) {
  const url = API_URL();
  if (!url) throw new Error('ATD_API_URL is not configured');

  const res = await fetch(`${url}/api/run/full`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ cycle }),
  });

  if (!res.ok) {
    throw new Error(`Agent server returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function getRunStatus(runId: string) {
  const url = API_URL();
  if (!url) throw new Error('ATD_API_URL is not configured');

  const res = await fetch(`${url}/api/status/${runId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Agent server returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
