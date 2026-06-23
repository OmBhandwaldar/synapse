'use client';

import { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Rocket, CheckCircle2, ChevronRight, Upload, Sparkles, Code, Terminal, Layers, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useAlgorandWallet } from '@/components/Providers';
import { listSkill } from '@/lib/SkillMarketplaceClient';

// ─── Skill File Format Template ───────────────────────────────────────────────
const SKILL_TEMPLATE = `{
  "cortex_skill_version": "1.0",
  "name": "My Skill Name",
  "type": "Logic",
  "version": "1.0.0",
  "description": "What does this skill do?",
  "entry_point": "compute",
  "parameters": {
    "input_a": { "type": "number", "required": true },
    "input_b": { "type": "string", "required": false }
  },
  "code": {
    "language": "javascript",
    "source": "function compute({ input_a, input_b }) {\\n  // Your skill logic here\\n  return { result: input_a * 2 };\\n}"
  },
  "metadata": {
    "author": "your_name",
    "tags": ["tag1", "tag2"],
    "min_agent_version": "1.0"
  }
}`;

const SKILL_TYPES = ['Logic', 'Compute', 'State', 'Data', 'Prediction', 'Strategy'];

type Step = 1 | 2 | 3 | 4;

interface SkillFile {
  name: string;
  type: string;
  version: string;
  description: string;
  code: { language: string; source: string };
  metadata: { author: string; tags: string[] };
}

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: Step; total: number }) {
  const labels = ['Skill Info', 'Upload File', 'Set Price', 'Sign & List'];
  return (
    <div className="flex items-center gap-0 mb-10">
      {labels.map((label, i) => {
        const step = (i + 1) as Step;
        const active = step === current;
        const done = step < current;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 flex items-center justify-center border-3 border-inkBlack font-heading text-sm font-bold transition-all ${
                done ? 'bg-punkGreen text-inkBlack' :
                active ? 'bg-punkYellow text-inkBlack shadow-[3px_3px_0px_#1A1A1A]' :
                'bg-white text-streetGray'
              }`}>
                {done ? '✓' : step}
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-widest hidden sm:block ${active ? 'text-inkBlack font-bold' : 'text-streetGray'}`}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-[3px] mx-2 mb-5 ${done ? 'bg-punkGreen' : 'bg-borderSoft'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Skill Info ───────────────────────────────────────────────────────
function Step1({ data, onChange, onNext }: {
  data: { name: string; skillType: string; version: string; description: string };
  onChange: (k: string, v: string) => void;
  onNext: () => void;
}) {
  const valid = data.name.trim() && data.skillType && data.version.trim() && data.description.trim();
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-inkBlack mb-2 font-mono">
          Skill Name <span className="text-punkPink">*</span>
        </label>
        <input
          value={data.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="e.g. Nim Subtraction Solver"
          className="w-full border-3 border-inkBlack bg-white px-4 py-3 font-body text-inkBlack text-sm focus:outline-none focus:border-punkYellow focus:shadow-[4px_4px_0px_#FFE600] transition-all"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-inkBlack mb-2 font-mono">
            Type <span className="text-punkPink">*</span>
          </label>
          <select
            value={data.skillType}
            onChange={e => onChange('skillType', e.target.value)}
            className="w-full border-3 border-inkBlack bg-white px-4 py-3 font-body text-inkBlack text-sm focus:outline-none focus:border-punkYellow cursor-pointer"
          >
            <option value="">Select type…</option>
            {SKILL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-inkBlack mb-2 font-mono">
            Version <span className="text-punkPink">*</span>
          </label>
          <input
            value={data.version}
            onChange={e => onChange('version', e.target.value)}
            placeholder="1.0.0"
            className="w-full border-3 border-inkBlack bg-white px-4 py-3 font-body text-inkBlack text-sm focus:outline-none focus:border-punkYellow transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-inkBlack mb-2 font-mono">
          Description <span className="text-punkPink">*</span>
        </label>
        <textarea
          value={data.description}
          onChange={e => onChange('description', e.target.value)}
          placeholder="What does this skill do? What problem does it solve?"
          rows={4}
          className="w-full border-3 border-inkBlack bg-white px-4 py-3 font-body text-inkBlack text-sm focus:outline-none focus:border-punkYellow transition-all resize-none"
        />
        <div className="text-right text-[10px] text-streetGray font-mono mt-1">{data.description.length}/256</div>
      </div>

      <button
        onClick={onNext}
        disabled={!valid}
        className="punk-btn w-full bg-punkYellow text-inkBlack py-4 font-heading text-lg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        NEXT → Upload File
      </button>
    </div>
  );
}

// ─── Step 2: Upload Skill File ────────────────────────────────────────────────
function Step2({ parsedFile, error, onFile, onNext, onBack }: {
  parsedFile: SkillFile | null;
  error: string;
  onFile: (f: File) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [showTemplate, setShowTemplate] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div className="space-y-6">
      {/* Template toggle */}
      <div className="punk-card bg-punkYellow/10 border-punkYellow p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-sm text-inkBlack uppercase tracking-wide">Skill File Format (.skill.json)</p>
            <p className="text-xs text-streetGray font-mono mt-0.5">Download the template, fill in your code, then upload</p>
          </div>
          <button
            onClick={() => setShowTemplate(!showTemplate)}
            className="punk-btn bg-punkYellow text-inkBlack px-4 py-2 text-xs font-heading"
          >
            {showTemplate ? 'HIDE' : 'VIEW TEMPLATE'}
          </button>
        </div>

        {showTemplate && (
          <div className="mt-4">
            <pre className="bg-inkBlack text-punkGreen text-xs p-4 overflow-x-auto font-mono leading-relaxed border-2 border-inkBlack" style={{ maxHeight: 320 }}>
              {SKILL_TEMPLATE}
            </pre>
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => {
                  const blob = new Blob([SKILL_TEMPLATE], { type: 'application/json' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                  a.download = 'my_skill.skill.json'; a.click();
                }}
                className="punk-btn bg-inkBlack text-white px-4 py-2 text-xs font-heading"
              >
                ↓ DOWNLOAD TEMPLATE
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(SKILL_TEMPLATE)}
                className="punk-btn bg-white text-inkBlack px-4 py-2 text-xs font-heading"
              >
                COPY JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-4 border-dashed cursor-pointer p-10 text-center transition-all ${
          dragOver ? 'border-punkYellow bg-punkYellow/10' : 'border-inkBlack hover:border-punkPink hover:bg-punkPink/5'
        } ${parsedFile ? 'border-punkGreen bg-punkGreen/5' : ''}`}
      >
        <input ref={inputRef} type="file" accept=".json,.skill.json" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        {parsedFile ? (
          <div className="space-y-2">
            <div className="text-4xl">✅</div>
            <p className="font-heading text-inkBlack text-lg uppercase">{parsedFile.name}</p>
            <p className="text-xs font-mono text-streetGray">{parsedFile.type} • v{parsedFile.version}</p>
            <p className="text-xs font-mono text-punkGreen uppercase tracking-widest">File validated ✓</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">📦</div>
            <p className="font-heading text-inkBlack text-xl uppercase">Drop .skill.json here</p>
            <p className="text-xs font-mono text-streetGray">or click to browse</p>
          </div>
        )}
      </div>

      {error && (
        <div className="border-3 border-punkRed bg-punkRed/10 p-3 font-mono text-xs text-punkRed">
          ⚠ {error}
        </div>
      )}

      {/* Code preview */}
      {parsedFile?.code?.source && (
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-streetGray mb-2">Code Preview (will be encrypted)</p>
          <pre className="bg-inkBlack text-punkGreen text-xs p-4 overflow-x-auto font-mono leading-relaxed border-2 border-inkBlack" style={{ maxHeight: 200 }}>
            {parsedFile.code.source}
          </pre>
          <p className="text-[9px] font-mono text-streetGray mt-1 flex items-center gap-1">
            🔒 This code will be AES-256-GCM encrypted before being uploaded to 0G Storage
          </p>
        </div>
      )}

      <div className="flex gap-4">
        <button onClick={onBack} className="punk-btn bg-white text-inkBlack px-6 py-3 font-heading flex-1">← BACK</button>
        <button
          onClick={onNext}
          disabled={!parsedFile}
          className="punk-btn bg-punkYellow text-inkBlack py-3 font-heading flex-1 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          NEXT → Set Price
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Set Price ────────────────────────────────────────────────────────
function Step3({ price, onChange, onNext, onBack }: {
  price: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const priceNum = parseFloat(price) || 0;
  const platformFee = priceNum * 0.05;
  const youReceive = priceNum - platformFee;
  const valid = priceNum >= 0.1;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-inkBlack mb-2 font-mono">
          Price (ALGO) <span className="text-punkPink">*</span>
        </label>
        <div className="relative">
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={price}
            onChange={e => onChange(e.target.value)}
            placeholder="10.0"
            className="w-full border-3 border-inkBlack bg-white px-4 py-4 font-mono text-inkBlack text-2xl focus:outline-none focus:border-punkYellow focus:shadow-[4px_4px_0px_#FFE600] transition-all pr-20"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-heading text-streetGray text-lg">ALGO</span>
        </div>
        <p className="text-xs font-mono text-streetGray mt-2">Minimum 0.1 ALGO</p>
      </div>

      {priceNum > 0 && (
        <div className="punk-card p-4 space-y-3 bg-white">
          <p className="font-heading text-xs uppercase tracking-widest text-streetGray">Fee Breakdown</p>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-streetGray">Listed Price</span>
              <span className="text-inkBlack font-bold">{priceNum.toFixed(2)} ALGO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-punkPink">Platform Fee (5%)</span>
              <span className="text-punkPink">- {platformFee.toFixed(2)} ALGO</span>
            </div>
            <div className="border-t-2 border-inkBlack pt-2 flex justify-between">
              <span className="text-inkBlack font-bold uppercase">You Receive</span>
              <span className="text-punkGreen font-bold text-lg">{youReceive.toFixed(2)} ALGO</span>
            </div>
          </div>
        </div>
      )}

      <div className="punk-card bg-bgCream border-streetGray/30 p-4">
        <p className="text-[10px] font-mono text-streetGray uppercase tracking-widest">
          Also Required: ~0.22 ALGO MBR for on-chain box storage (one time, non-refundable)
        </p>
      </div>

      <div className="flex gap-4">
        <button onClick={onBack} className="punk-btn bg-white text-inkBlack px-6 py-3 font-heading flex-1">← BACK</button>
        <button
          onClick={onNext}
          disabled={!valid}
          className="punk-btn bg-punkYellow text-inkBlack py-3 font-heading flex-1 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          NEXT → Sign & List
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Sign & Submit ────────────────────────────────────────────────────
function Step4({ info, file, price, onBack, onSubmit, submitting, done, txId }: {
  info: { name: string; skillType: string; version: string; description: string };
  file: SkillFile | null;
  price: string;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  done: boolean;
  txId: string;
}) {
  if (done) {
    return (
      <div className="text-center space-y-6 py-8">
        <div className="text-7xl">🎉</div>
        <h2 className="font-heading text-3xl text-inkBlack uppercase">
          <span className="bg-punkGreen px-2">SKILL LISTED!</span>
        </h2>
        <p className="font-mono text-xs text-streetGray uppercase tracking-widest">Your skill is now live on the marketplace</p>
        {txId && (
          <a
            href={`https://testnet.explorer.perawallet.app/tx/${txId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-punkBlue hover:text-punkPink transition-colors border-b border-punkBlue/30 pb-0.5"
          >
            <ExternalLink size={12} />
            Verify on Pera Explorer
          </a>
        )}
        <div className="flex gap-4 justify-center">
          <Link href="/marketplace" className="punk-btn bg-punkYellow text-inkBlack px-8 py-3 font-heading">
            ← Back to Market
          </Link>
          <button onClick={() => window.location.reload()} className="punk-btn bg-white text-inkBlack px-8 py-3 font-heading">
            List Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="punk-card p-5 space-y-3 bg-white">
        <p className="font-heading text-xs uppercase tracking-widest text-streetGray">Listing Summary</p>
        <div className="space-y-2 text-sm font-body">
          <div className="flex justify-between border-b border-borderSoft pb-2">
            <span className="text-streetGray">Skill Name</span>
            <span className="font-bold text-inkBlack">{info.name}</span>
          </div>
          <div className="flex justify-between border-b border-borderSoft pb-2">
            <span className="text-streetGray">Type</span>
            <span className="font-bold text-inkBlack">{info.skillType}</span>
          </div>
          <div className="flex justify-between border-b border-borderSoft pb-2">
            <span className="text-streetGray">Version</span>
            <span className="font-mono text-inkBlack">{info.version}</span>
          </div>
          <div className="flex justify-between border-b border-borderSoft pb-2">
            <span className="text-streetGray">Price</span>
            <span className="font-bold text-punkGreen font-mono">{price} ALGO</span>
          </div>
          <div className="flex justify-between pb-2">
            <span className="text-streetGray">Storage fee</span>
            <span className="font-mono text-inkBlack">~0.22 ALGO (MBR)</span>
          </div>
        </div>
      </div>

      <div className="border-3 border-dashed border-inkBlack bg-bgCream p-4 text-xs font-mono space-y-1 text-streetGray">
        <p className="text-inkBlack font-bold uppercase tracking-widest">What happens next:</p>
        <p>1. Your code is encrypted with AES-256-GCM</p>
        <p>2. Encrypted file is uploaded to 0G Storage</p>
        <p>3. Two transactions are signed: MBR payment + contract call</p>
        <p>4. Skill is listed on-chain. Buyers can find it immediately.</p>
      </div>

      <div className="flex gap-4">
        <button onClick={onBack} disabled={submitting} className="punk-btn bg-white text-inkBlack px-6 py-3 font-heading flex-1 disabled:opacity-40">
          ← BACK
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="punk-btn bg-punkYellow text-inkBlack py-3 font-heading flex-2 flex-1 text-lg disabled:opacity-60 relative"
        >
          {submitting ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="animate-spin">⟳</span> Processing…
            </span>
          ) : '✦ SIGN & LIST SKILL'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ListSkillPage() {
  const { activeAddress, getSigner } = useAlgorandWallet();
  const [step, setStep] = useState<Step>(1);

  // Step 1 data
  const [info, setInfo] = useState({ name: '', skillType: '', version: '1.0.0', description: '' });

  // Step 2 data
  const [parsedFile, setParsedFile] = useState<SkillFile | null>(null);
  const [fileError, setFileError] = useState('');

  // Step 3 data
  const [price, setPrice] = useState('');

  // Step 4 state
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [txId, setTxId] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleInfoChange = (k: string, v: string) => setInfo(prev => ({ ...prev, [k]: v }));

  const handleFile = (file: File) => {
    setFileError('');
    setParsedFile(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.name || !json.type || !json.code?.source) {
          throw new Error('Missing required fields: name, type, code.source');
        }
        if (json.cortex_skill_version !== '1.0') {
          throw new Error('cortex_skill_version must be "1.0"');
        }
        setParsedFile(json);
        // Auto-fill step 1 if user uploads first
        if (!info.name) setInfo(prev => ({
          ...prev,
          name: json.name || prev.name,
          skillType: json.type || prev.skillType,
          version: json.version || prev.version,
          description: json.description || prev.description,
        }));
      } catch (err: unknown) {
        setFileError(`Invalid skill file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!activeAddress || !parsedFile) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // 1. Encrypt + upload to IPFS via our API route
      const uploadRes = await fetch('/api/skills/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillSource: parsedFile.code.source,
          metadata: {
            name: info.name,
            type: info.skillType,
            version: info.version,
            seller: activeAddress,
          },
        }),
      });

      if (!uploadRes.ok) throw new Error('Failed to upload to 0G Storage');
      const { rootHash } = await uploadRes.json();

      // 2. List the skill on 0G Chain, signed by the connected MetaMask wallet.
      const signer = await getSigner();
      const newTxId = await listSkill(signer, {
        name: info.name,
        description: info.description,
        skillType: info.skillType,
        version: info.version,
        priceOg: parseFloat(price),
        storageRootHash: rootHash,
      });

      setTxId(newTxId);
      setDone(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeAddress) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center">
        <div className="text-6xl">🔐</div>
        <h1 className="font-heading text-4xl">
          <span className="bg-punkYellow px-2">CONNECT</span> WALLET
        </h1>
        <p className="font-mono text-streetGray text-sm uppercase tracking-widest">You need a connected Algorand wallet to list skills</p>
        <Link href="/marketplace" className="punk-btn bg-inkBlack text-white px-8 py-3 font-heading">
          ← Back to Market
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/marketplace" className="text-streetGray hover:text-punkPink transition-colors font-mono text-xs uppercase tracking-widest">
            ← Market
          </Link>
          <span className="text-streetGray">/</span>
          <span className="font-mono text-xs uppercase tracking-widest text-inkBlack">List Skill</span>
        </div>
        <h1 className="font-heading text-5xl md:text-6xl uppercase leading-none">
          <span className="block">LIST YOUR</span>
          <span className="bg-punkYellow px-3 block w-fit mt-1">SKILL</span>
        </h1>
        <p className="font-mono text-xs text-streetGray uppercase tracking-widest mt-4">
          Monetize your AI logic on the Cortex marketplace // Fully on-chain
        </p>
      </div>

      {/* Main card */}
      <div className="max-w-2xl">
        <div className="punk-card bg-bgCream p-8">
          <StepIndicator current={step} total={4} />

          {step === 1 && (
            <Step1
              data={info}
              onChange={handleInfoChange}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              parsedFile={parsedFile}
              error={fileError}
              onFile={handleFile}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              price={price}
              onChange={setPrice}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <>
              {submitError && (
                <div className="mb-4 border-3 border-punkRed bg-punkRed/10 p-3 font-mono text-xs text-punkRed">
                  ⚠ {submitError}
                </div>
              )}
              <Step4
                info={info}
                file={parsedFile}
                price={price}
                onBack={() => setStep(3)}
                onSubmit={handleSubmit}
                submitting={submitting}
                done={done}
                txId={txId}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
