const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bqpgiwqbnqquibepoknm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcGdpd3FibnFxdWliZXBva25tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzYzMywiZXhwIjoyMDkyNjA5NjMzfQ.nMtnuRF0nm8CxZPizQNBnAaz8xZbhkN0g8n_h4oUJb0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Querying match_simulations match_ids...');
  const { data, error } = await supabase.from('match_simulations').select('match_id, created_at');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('All simulated match IDs:', data);
  }
}

run();
