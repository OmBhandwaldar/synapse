/**
 * deploy.mjs — Deploy AlgocredBountyManager to Algorand TestNet
 *
 * Usage:
 *   node deploy.mjs <MNEMONIC>
 *
 * Example:
 *   node deploy.mjs "word1 word2 word3 ... word25"
 *
 * After success, copy the printed App ID into .env.local as:
 *   NEXT_PUBLIC_MANAGER_APP_ID=<id>
 */

import algosdk from 'algosdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ──────────────────────────────────────────────────────────────────
const ALGOD_SERVER  = 'https://testnet-api.algonode.cloud'
const ALGOD_TOKEN   = ''
const ALGOD_PORT    = ''

const APPROVAL_TEAL = path.join(__dirname, 'contracts/artifacts/AlgocredBountyManager.approval.teal')
const CLEAR_TEAL    = path.join(__dirname, 'contracts/artifacts/AlgocredBountyManager.clear.teal')

// ─── Main ─────────────────────────────────────────────────────────────────────
const mnemonic = process.argv[2]
if (!mnemonic) {
  console.error('\nUsage: node deploy.mjs "<your 25-word mnemonic>"\n')
  process.exit(1)
}

const account = algosdk.mnemonicToSecretKey(mnemonic)
const addrStr  = account.addr.toString()   // algosdk v2: addr is an Address object
console.log(`\n🔑 Deploying from: ${addrStr}\n`)

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT)

// Compile TEAL source to bytecode
async function compileTeal(source) {
  const result = await algod.compile(source).do()
  return new Uint8Array(Buffer.from(result.result, 'base64'))
}

// Read → compile both programs
const approvalSource = fs.readFileSync(APPROVAL_TEAL, 'utf8')
const clearSource    = fs.readFileSync(CLEAR_TEAL, 'utf8')

console.log('⚙️  Compiling TEAL programs...')
const approvalProgram = await compileTeal(approvalSource)
const clearProgram    = await compileTeal(clearSource)
console.log('✅ Compiled OK\n')

// Encode the createApplication ABI call
// Method: createApplication(address)void
const abiMethod = new algosdk.ABIMethod({
  name: 'createApplication',
  desc: 'Initializes the manager contract.',
  args: [{ name: 'maintainerAddress', type: 'address' }],
  returns: { type: 'void' },
})

const methodSelector = abiMethod.getSelector()
// In algosdk v2, account.addr is an Address object — use .publicKey directly
const encodedAddr    = account.addr.publicKey ?? algosdk.decodeAddress(account.addr.toString()).publicKey

// The ABI arg is just a bare 32-byte public key for 'address' type
const appArgs = [
  methodSelector,
  encodedAddr,
]

// Fetch suggested params
const sp = await algod.getTransactionParams().do()
sp.fee = 1000
sp.flatFee = true

// Create the application creation transaction
const txn = algosdk.makeApplicationCreateTxnFromObject({
  sender: addrStr,
  suggestedParams: sp,
  onComplete: algosdk.OnApplicationComplete.NoOpOC,
  approvalProgram,
  clearProgram,
  numGlobalByteSlices: 1,   // maintainerAddress
  numGlobalInts: 2,          // totalBounties, lastBountyID
  numLocalByteSlices: 0,
  numLocalInts: 0,
  appArgs,
})

const signedTxn = txn.signTxn(account.sk)

console.log('📡 Sending transaction to TestNet...')
const sendResult = await algod.sendRawTransaction(signedTxn).do()
const txid = sendResult.txid   // algosdk v2 uses lowercase 'txid'
console.log(`📨 TX ID: ${txid}`)

// Wait for confirmation
const result = await algosdk.waitForConfirmation(algod, txid, 8)
const appId  = result['application-index'] ?? result.applicationIndex

console.log('\n==========================================')
console.log(`✅ CONTRACT DEPLOYED SUCCESSFULLY`)
console.log(`   App ID:      ${appId}`)
console.log(`   App Address: ${algosdk.getApplicationAddress(appId)}`)
console.log('==========================================')
console.log(`\nAdd this to your .env.local:\n  NEXT_PUBLIC_MANAGER_APP_ID=${appId}\n`)
