import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('--- Testing insert into agent_moves ---');
  const { data: insertData, error: insertError } = await supabase
    .from('agent_moves')
    .insert({
      match_id: 9999,
      agent_address: 'TEST_ADDRESS',
      move: 1,
      salt: 'TEST_SALT_BASE64',
    })
    .select();

  if (insertError) {
    console.error('Insert failed:', insertError);
  } else {
    console.log('Insert succeeded:', insertData);
  }

  const { data: moves, error: errorMoves } = await supabase.from('agent_moves').select('*');
  console.log('--- agent_moves table ---');
  if (errorMoves) console.error(errorMoves);
  else console.log(moves);

  console.log('--- Cleaning up test record ---');
  const { error: deleteError } = await supabase
    .from('agent_moves')
    .delete()
    .eq('match_id', 9999);
  if (deleteError) console.error('Delete cleanup failed:', deleteError);
  else console.log('Cleanup succeeded');

  const { data: sims, error: errorSims } = await supabase.from('match_simulations').select('*');
  console.log('--- match_simulations table ---');
  if (errorSims) console.error(errorSims);
  else console.log(sims);

  const { data: agents, error: errorAgents } = await supabase.from('agents').select('*');
  console.log('--- agents table ---');
  if (errorAgents) console.error(errorAgents);
  else console.log(agents.map(a => ({ id: a.id, name: a.agent_name, address: a.agent_address })));
}

main();

