const fs = require('fs');
const path = require('path');

// 1. Parse .env.local to get GEMINI_API_KEY and other configuration
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('No .env.local file found. Please run this script from the project root.');
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  });
  return env;
}

const env = loadEnv();
const apiKey = env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not defined in .env.local.');
  process.exit(1);
}

// 2. Helper to scan directory recursively
function scanDir(dir, filter = () => true) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'artifacts' && file !== '.git') {
        results.push({ name: file, type: 'dir', path: path.relative(process.cwd(), fullPath) });
        results = results.concat(scanDir(fullPath, filter));
      }
    } else {
      if (filter(file)) {
        results.push({ name: file, type: 'file', path: path.relative(process.cwd(), fullPath) });
      }
    }
  });
  return results;
}

// 3. Gather project details
console.log('Scanning codebase directory structure...');
const apiFiles = scanDir(path.join(process.cwd(), 'src/app/api'), f => f.endsWith('.ts') || f.endsWith('.js'));
const pageFiles = scanDir(path.join(process.cwd(), 'src/app/(main)'), f => f.endsWith('.tsx'));
const contractFiles = scanDir(path.join(process.cwd(), 'contracts'), f => f.endsWith('.ts'));
const supabaseFiles = scanDir(path.join(process.cwd(), 'supabase'), f => f.endsWith('.sql'));

// Read key file contents
const contractContent = fs.existsSync(path.join(process.cwd(), 'contracts/AgentRegistry.algo.ts'))
  ? fs.readFileSync(path.join(process.cwd(), 'contracts/AgentRegistry.algo.ts'), 'utf8').slice(0, 4000) // first 4k chars
  : '';

const sqlContent = fs.existsSync(path.join(process.cwd(), 'supabase/update.sql'))
  ? fs.readFileSync(path.join(process.cwd(), 'supabase/update.sql'), 'utf8')
  : '';

// Compile summary of project structure
const projectSummary = `
--- PROJECT STRUCTURE ---
API Endpoints:
${apiFiles.map(f => `- ${f.path}`).join('\n')}

Frontend Pages:
${pageFiles.map(f => `- ${f.path}`).join('\n')}

Smart Contracts:
${contractFiles.map(f => `- ${f.path}`).join('\n')}

Database Schemas:
${supabaseFiles.map(f => `- ${f.path}`).join('\n')}

--- CONTRACT METHODS (TRUNCATED) ---
${contractContent}

--- SUPABASE SCHEMA ---
${sqlContent}
`;

// 4. Helper to call Gemini API
async function askGemini(systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nHere is the codebase information:\n${projectSummary}\n\nTask: ${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  
  // Strip code blocks if LLM wraps the markdown file in \`\`\`markdown ... \`\`\`
  return text.trim().replace(/^```markdown\n/, '').replace(/^```/, '').replace(/```$/, '').trim();
}

// 5. Run the documentation updates
async function updateDocumentation() {
  try {
    // A. Update docs/project_overview.md
    console.log('Generating docs/project_overview.md...');
    const overviewPath = path.join(process.cwd(), 'docs/project_overview.md');
    const oldOverview = fs.existsSync(overviewPath) ? fs.readFileSync(overviewPath, 'utf8') : '';
    
    const overviewPrompt = `Update the project_overview.md file. Keep the existing structure but incorporate the new predictions/escrow system (server-managed escrow model with EscrowManager and payout logic), match history showing actual settled matches, live ELO leaderboard based on agent box stats, and custom dialog overlays replacing native popups. Output ONLY the complete updated markdown file content.`;
    const newOverview = await askGemini(
      "You are an expert technical writer. You will update the project overview documentation for CORTEX. Return ONLY raw markdown content. No surrounding markdown code blocks.",
      overviewPrompt
    );
    fs.writeFileSync(overviewPath, newOverview, 'utf8');
    console.log('Updated docs/project_overview.md successfully.');

    // B. Update docs/backend_architecture.md
    console.log('Generating docs/backend_architecture.md...');
    const archPath = path.join(process.cwd(), 'docs/backend_architecture.md');
    const oldArch = fs.existsSync(archPath) ? fs.readFileSync(archPath, 'utf8') : '';
    
    const archPrompt = `Update the backend_architecture.md file. Include the new predictions endpoints (/api/predictions/bet, /api/predictions/submit, /api/predictions/list), the updated match settlement route (/api/match/settle) which now triggers payouts via the EscrowManager, and the leaderboard route (/api/leaderboard). Update the directory structure tree, database schema layout (adding predictions table), and endpoints list. Output ONLY the complete updated markdown file content.`;
    const newArch = await askGemini(
      "You are an expert software architect. You will update the backend architecture map for CORTEX. Return ONLY raw markdown content. No surrounding markdown code blocks.",
      archPrompt
    );
    fs.writeFileSync(archPath, newArch, 'utf8');
    console.log('Updated docs/backend_architecture.md successfully.');

    // C. Update README.md
    console.log('Generating README.md...');
    const readmePath = path.join(process.cwd(), 'README.md');
    const oldReadme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
    
    const readmePrompt = `Update the main README.md for the CORTEX platform. Ensure it accurately lists all key features including the predictions market, ELO leaderboards, custom dialogs, match history, and machine-to-machine marketplace. Make it premium and professional for a hackathon final submission. Note: Do NOT mention Shibuya Punk or placeholders. Include the new update script setup in instructions. Output ONLY the complete updated markdown file content.`;
    const newReadme = await askGemini(
      "You are a developer relations expert. You will update the README.md for the CORTEX project. Return ONLY raw markdown content. No surrounding markdown code blocks.",
      readmePrompt
    );
    fs.writeFileSync(readmePath, newReadme, 'utf8');
    console.log('Updated README.md successfully.');

    console.log('🎉 All documentation files updated successfully!');
  } catch (err) {
    console.error('Error updating documentation:', err);
  }
}

updateDocumentation();
