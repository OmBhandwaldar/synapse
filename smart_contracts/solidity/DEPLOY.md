# Deploying SkillMarketplace to 0G Galileo Testnet

The contract is deployed with **Foundry** (recommended by 0G; avoids the npm
`ethers` peer-dependency conflict between `@0glabs/0g-ts-sdk` and Hardhat).

## 1. Install Foundry (once)
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## 2. Fund the platform wallet
Get testnet 0G for `PLATFORM_PRIVATE_KEY`'s address from https://faucet.0g.ai

## 3. Deploy
```bash
forge create \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $PLATFORM_PRIVATE_KEY \
  --evm-version cancun \
  smart_contracts/solidity/SkillMarketplace.sol:SkillMarketplace
```

## 4. Wire it up
Copy the deployed address into `.env.local`:
```
NEXT_PUBLIC_SKILL_MARKETPLACE_ADDRESS=0x...
```
Verify on the explorer: https://chainscan-galileo.0g.ai/address/<ADDRESS>

> The deployer becomes the contract `admin` and receives the 5% platform fee.
> The same key is used as the 0G Storage upload signer (`PLATFORM_PRIVATE_KEY`).
