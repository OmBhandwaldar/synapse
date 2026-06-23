const fs = require('fs');
const content = fs.readFileSync('src/app/api/arena/execute/route.ts', 'utf8');

const startIdx = content.indexOf('const engine: any = ENGINES[gameId as keyof typeof ENGINES];');
const endIdx = content.indexOf('} catch (err: any) {', startIdx);
if (startIdx === -1 || endIdx === -1) throw new Error('Not found');

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

const newLogic = `    const engine: any = ENGINES[gameId as keyof typeof ENGINES];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          try {
            controller.enqueue(encoder.encode(\`event: \${event}\\ndata: \${JSON.stringify(data)}\\n\\n\`));
          } catch (e) {}
        };

        let state = engine.getInitialState();
        const logs: MatchTurnLog[] = [];
        let turnCount    = 0;
        const MAX_TURNS  = 20;
        let isGameOver   = false;
        let finalWinner: string | null = null;
        let finalReason  = 'Max turns reached';

        try {
          while (!isGameOver && turnCount < MAX_TURNS) {
            turnCount++;
            const turnLogMessages: string[] = [];

            send('progress', { message: \`Turn \${turnCount}: Running agent local sandboxes...\` });

            // ── Run JS skill in sandbox (candidate moves) ─────────────────────────
            const [p1Sandbox, p2Sandbox] = await Promise.all([
              evaluateAgentMove(ag1.code, state, 'p1', logs),
              evaluateAgentMove(ag2.code, state, 'p2', logs),
            ]);

            let p1Move = p1Sandbox.success ? p1Sandbox.returnValue : (gameId === 'rps' ? 'R' : 1);
            let p2Move = p2Sandbox.success ? p2Sandbox.returnValue : (gameId === 'rps' ? 'R' : 1);

            if (!p1Sandbox.success) {
              finalWinner = 'p2'; finalReason = \`Agent 1 skill crashed: \${p1Sandbox.error}\`;
              logs.push({ turnNumber: turnCount, p1Move: null, p2Move: null, stateAfter: state, logMessages: [finalReason] });
              break;
            }
            if (!p2Sandbox.success) {
              finalWinner = 'p1'; finalReason = \`Agent 2 skill crashed: \${p2Sandbox.error}\`;
              logs.push({ turnNumber: turnCount, p1Move, p2Move: null, stateAfter: state, logMessages: [finalReason] });
              break;
            }

            send('progress', { message: \`Turn \${turnCount}: Paying x402 platform fees (0.05 ALGO) & invoking Gemini...\` });

            // ── x402: Both agents pay platform → LLM cognitively overrides ──────
            const [p1Cognition, p2Cognition] = await Promise.allSettled([
              x402LLMMove(agent1Address, ag1.name, gameId, state, logs, p1Move, ag1.skillSource),
              x402LLMMove(agent2Address, ag2.name, gameId, state, logs, p2Move, ag2.skillSource),
            ]);

            if (p1Cognition.status === 'fulfilled') {
              p1Move = p1Cognition.value.move;
              const payTag = p1Cognition.value.paid ? \`💳 tx:\${p1Cognition.value.txId?.slice(0, 8)}\` : '⚡ skill-only';
              turnLogMessages.push(\`🧠 [\${ag1.name}] \${payTag}: \${p1Cognition.value.reasoning}\`);
            } else {
              turnLogMessages.push(\`⚠️ [\${ag1.name}]: x402 failed (\${p1Cognition.reason?.message || 'unknown'}), using skill move.\`);
            }

            if (p2Cognition.status === 'fulfilled') {
              p2Move = p2Cognition.value.move;
              const payTag = p2Cognition.value.paid ? \`💳 tx:\${p2Cognition.value.txId?.slice(0, 8)}\` : '⚡ skill-only';
              turnLogMessages.push(\`🧠 [\${ag2.name}] \${payTag}: \${p2Cognition.value.reasoning}\`);
            } else {
              turnLogMessages.push(\`⚠️ [\${ag2.name}]: x402 failed (\${p2Cognition.reason?.message || 'unknown'}), using skill move.\`);
            }

            send('progress', { message: \`Turn \${turnCount}: Validating and resolving moves...\` });

            const p1Validated = engine.validateMove(state, p1Move, 'p1');
            const p2Validated = engine.validateMove(state, p2Move, 'p2');

            turnLogMessages.push(\`[\${ag1.name}] → \${JSON.stringify(p1Validated)}\`);
            turnLogMessages.push(\`[\${ag2.name}] → \${JSON.stringify(p2Validated)}\`);

            const computeResult = engine.computeNextState(state, p1Validated, p2Validated);
            state = computeResult.nextState;

            const turnLog: MatchTurnLog = {
              turnNumber:   turnCount,
              p1Move:       p1Validated,
              p2Move:       p2Validated,
              stateAfter:   state,
              logMessages:  turnLogMessages,
            };
            logs.push(turnLog);

            send('turn', turnLog);
            await new Promise(r => setTimeout(r, 100));

            if (computeResult.winner !== null) {
              isGameOver  = true;
              finalWinner = computeResult.winner === 'draw' ? 'draw'
                : computeResult.winner === 'p1' ? 'p1' : 'p2';
              finalReason = computeResult.reason ?? 'Match resolved';
            }
          }

          // ── Save simulation ───────────────────────────────────────────────────────
          const finalWinnerId = finalWinner === 'p1' ? 'p1'
            : finalWinner === 'p2' ? 'p2'
            : null;

          if (matchId !== undefined) {
            try {
              const { error: saveError } = await supabase.from('match_simulations').insert({
                match_id:  parseInt(matchId, 10),
                winner_id: finalWinnerId,
                reason:    finalReason,
                turns:     logs,
              });
              if (saveError) console.error('[Execute] Save sim error:', saveError);
            } catch (saveErr) {
              console.error('[Execute] Save sim exception:', saveErr);
            }
          }

          send('progress', { message: 'Battle simulation complete!' });
          send('result', { winnerId: finalWinnerId, reason: finalReason, turns: logs, finalState: state });

        } catch (streamErr: any) {
          console.error('[Execute] Stream execution error:', streamErr);
          send('error', { error: streamErr.message });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, { headers: SSE_HEADERS });

`;

fs.writeFileSync('src/app/api/arena/execute/route.ts', before + newLogic + after);
console.log('Successfully refactored route.ts');
