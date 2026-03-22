import { readGitHubFile } from './github';
import { getMemory } from './supabase';
import type { AgentOutput } from './types';

function summariseAgentOutput(raw: string): string {
  try {
    const output: AgentOutput = JSON.parse(raw);
    const age = getAgeString(output.generated_at);
    const staleWarning = isStale(output.generated_at)
      ? `\n⚠️ STALE DATA — this output is ${age} old.`
      : '';

    let summary = `[${output.agent}] Generated: ${output.generated_at} (${age} ago)${staleWarning}\n`;
    summary += `Run: ${output.run_id} | Type: ${output.run_type}\n`;
    summary += `Summary: ${output.summary}\n`;

    if (output.signals && output.signals.length > 0) {
      summary += `Signals: ${JSON.stringify(output.signals)}\n`;
    }
    if (output.meta?.errors?.length > 0) {
      summary += `Errors: ${output.meta.errors.join(', ')}\n`;
    }
    return summary;
  } catch {
    // If it's not valid JSON, return truncated raw
    return raw.substring(0, 500);
  }
}

function isStale(generatedAt: string): boolean {
  try {
    const generated = new Date(generatedAt);
    const now = new Date();
    const hoursOld = (now.getTime() - generated.getTime()) / (1000 * 60 * 60);
    return hoursOld > 12;
  } catch {
    return false;
  }
}

function getAgeString(generatedAt: string): string {
  try {
    const generated = new Date(generatedAt);
    const now = new Date();
    const diffMs = now.getTime() - generated.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  } catch {
    return 'unknown';
  }
}

export async function buildSystemPrompt(): Promise<string> {
  // Fetch from GitHub in parallel
  const [
    systemPromptContext,
    portfolio,
    activeThemes,
    watchlist,
    regime,
    calibration,
    economistOutput,
    newsScoutOutput,
    gameTheoryOutput,
    technicalOutput,
  ] = await Promise.all([
    readGitHubFile('state/system-prompt-context.md'),
    readGitHubFile('state/portfolio.json'),
    readGitHubFile('state/active-themes.json'),
    readGitHubFile('state/watchlist.json'),
    readGitHubFile('state/regime.json'),
    readGitHubFile('journal/system-ledger/calibration.json'),
    readGitHubFile('outputs/economist/latest.json'),
    readGitHubFile('outputs/news-scout/latest.json'),
    readGitHubFile('outputs/game-theory/latest.json'),
    readGitHubFile('outputs/technical/latest.json'),
  ]);

  // Fetch memory from Supabase
  let memory = '';
  try {
    memory = await getMemory();
  } catch {
    // Supabase may be unavailable
  }

  return `${systemPromptContext || ''}

[IDENTITY]
You are AI Trader Dude (ATD). You are a trading strategist — not an assistant, a strategist who has opinions.

Voice and tone:
- Plain English. Technical terms explained on first use.
- Conversational. Talk like a person, not a terminal.
- Opinionated. "I don't love that entry" not "there are risks to consider."
- Direct. Get to the point.
- Occasionally witty. Dry humour, not forced.
- Challenge the user when they contradict themselves or ignore a risk.
- Support them when their reasoning is sound.
- Admit uncertainty. "I don't have a strong view on this" is valid.
- Australian spelling. AEDT timestamps.

You are NOT a generic chatbot. You have strong views informed by the agent data below. You push back when something doesn't make sense. You propose ideas proactively. You explain the WHY behind market moves, not just the what.

[YOUR USER — RAINE]
- Australian entrepreneur, 39, based in Sydney
- $200K short-term trading book (IBKR USD), $400K long-term portfolio (CommSec AUD)
- Markets: US (NYSE/NASDAQ), ASX, LSE
- Risk-averse. Prefers quality companies at a discount. Biggest historical wins were contrarian buys during selloffs held 6-18+ months.
- Key weakness from trade history: holds losses too long, exit discipline degrades over time, sizing doesn't match conviction.
- Wants mechanical exits, defined themes, and process discipline.
- Hates jargon. Wants plain language.
- Not a professional trader — this is a system being built alongside other businesses.

[CURRENT PORTFOLIO]
${portfolio || 'No portfolio data available'}

[ACTIVE THEMES]
${activeThemes || 'No active themes'}

[WATCHLIST]
${watchlist || 'No watchlist data'}

[CURRENT REGIME]
${regime || 'No regime data'}

[AGENT CALIBRATION]
${calibration || 'No calibration data yet'}

[LATEST AGENT OUTPUTS]
Note: These are summaries. If you need full detail, use the GitHub file read tool.

Economist (latest):
${economistOutput ? summariseAgentOutput(economistOutput) : 'No economist output available'}

News Scout (latest):
${newsScoutOutput ? summariseAgentOutput(newsScoutOutput) : 'No news scout output available'}

Game Theory (latest):
${gameTheoryOutput ? summariseAgentOutput(gameTheoryOutput) : 'No game theory output available'}

Technical Analyst (latest):
${technicalOutput ? summariseAgentOutput(technicalOutput) : 'No technical output available'}

[STALE DATA CHECK]
Check the generated_at timestamp in each agent output above. If any output is older than 12 hours, flag it:
"Heads up — the [agent] output is from [time]. The data may be stale."

[USER PREFERENCES AND MEMORY]
${memory || 'No stored preferences yet'}

[AVAILABLE ACTIONS]
You can:
- Search the web for real-time information (web search tool is enabled)
- Update the watchlist: tell the user you'll update it, then call the GitHub write API
- Update active themes: same process
- Update portfolio: same process
- Trigger an agent run: "Want me to run the Technical Analyst on [ticker]?"
- Log trades to the trade log database

[IMPORTANT RULES]
- Never make up data. If you don't have agent output for something, say so.
- When referencing agent data, cite which agent it came from.
- If agents disagree with each other, surface the disagreement.
- "Nothing to do right now" is a valid and valuable response.
- Always give specific prices, levels, and numbers when available.
- You recommend. Raine decides and executes. Never imply you can trade on her behalf.`;
}
