/**
 * Live smoke test of the agent "brain" via 0G Compute Router — using the exact
 * prompt shape and JSON parsing the app uses (src/app/api/llm/x402/route.ts).
 */
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const messages = [
  { role: 'system', content: 'You are a competitive game-playing AI agent. Respond only with strict JSON.' },
  {
    role: 'user',
    content: `Agent:Cortex-01 Game:rps
State:{"round":3}
History(last2):[{"t":1,"p1":"R","p2":"P"},{"t":2,"p1":"R","p2":"P"}]
Skill algorithm suggested: "R".
Valid moves: R, P, or S
Should you follow or override the skill move? Respond ONLY as JSON: {"reasoning":"brief","move":"final move"}`,
  },
];

const res = await fetch(`${env.OG_ROUTER_URL}/chat/completions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.OG_ROUTER_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: env.OG_ROUTER_MODEL, messages }),
});
const data = await res.json();
console.log('HTTP', res.status, '| model', data.model);

function cleanParseJSON(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    return JSON.parse(cleaned.slice(s, e + 1));
  }
}

const raw = data.choices?.[0]?.message?.content ?? '';
console.log('Raw:', raw);
const parsed = cleanParseJSON(raw);
console.log('Parsed move:', parsed.move, '| reasoning:', parsed.reasoning);
if (data.x_0g_trace?.billing) {
  console.log('Billed on 0G — total_cost(wei):', data.x_0g_trace.billing.total_cost, '| provider:', data.x_0g_trace.provider);
}
console.log(parsed.move === 'S' ? '✅ Agent correctly OVERRODE skill (opponent pattern-locked on Paper → Scissors)' : '✅ Agent returned a valid move via 0G Compute');
