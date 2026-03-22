const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // rainegui/AI-Trader-Dude

export async function readGitHubFile(path: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.raw+json',
        },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function writeGitHubFile(
  path: string,
  content: string,
  message: string
): Promise<boolean> {
  try {
    // Get current file SHA if it exists
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      }
    );
    const currentFile = getRes.ok ? await getRes.json() : null;

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString('base64'),
          sha: currentFile?.sha,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
