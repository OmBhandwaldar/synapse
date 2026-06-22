/**
 * 0G Chain helpers (Galileo testnet, EVM-compatible).
 * Central place for the provider, network constants, and the SkillMarketplace
 * contract binding. Replaces the old algosdk Algodv2/Indexer setup.
 */
import { ethers } from 'ethers';

export const OG_RPC_URL =
  process.env.OG_RPC_URL ??
  process.env.NEXT_PUBLIC_OG_RPC_URL ??
  'https://evmrpc-testnet.0g.ai';

export const OG_CHAIN_ID = Number(
  process.env.OG_CHAIN_ID ?? process.env.NEXT_PUBLIC_OG_CHAIN_ID ?? 16602
);

export const OG_EXPLORER = 'https://chainscan-galileo.0g.ai';

export const MARKETPLACE_ADDRESS =
  process.env.NEXT_PUBLIC_SKILL_MARKETPLACE_ADDRESS ?? '';

/** Minimal ABI for the SkillMarketplace Solidity contract. */
export const MARKETPLACE_ABI = [
  'function skillCount() view returns (uint256)',
  'function platformFeeBps() view returns (uint256)',
  'function admin() view returns (address)',
  'function hasAccess(uint256 skillId, address buyer) view returns (bool)',
  'function getSkill(uint256 skillId) view returns (tuple(string name,string description,string skillType,string version,uint256 price,address seller,string storageRootHash,uint256 soldCount,uint256 listedAt,bool active))',
  'function listSkill(string name,string description,string skillType,string version,uint256 price,string storageRootHash) returns (uint256)',
  'function buySkill(uint256 skillId) payable',
  'function delistSkill(uint256 skillId)',
  'function setPlatformFee(uint256 feeBps)',
  'event SkillListed(uint256 indexed skillId, address indexed seller, uint256 price, string storageRootHash)',
  'event SkillPurchased(uint256 indexed skillId, address indexed buyer, uint256 price)',
];

/** Read-only JSON-RPC provider for 0G Chain. */
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(OG_RPC_URL, OG_CHAIN_ID);
}

/**
 * Returns a SkillMarketplace contract bound to either a signer (for writes)
 * or the default read-only provider.
 */
export function getMarketplaceContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  if (!MARKETPLACE_ADDRESS) {
    throw new Error('NEXT_PUBLIC_SKILL_MARKETPLACE_ADDRESS is not configured');
  }
  return new ethers.Contract(
    MARKETPLACE_ADDRESS,
    MARKETPLACE_ABI,
    signerOrProvider ?? getProvider()
  );
}

/** Galileo network params for MetaMask wallet_addEthereumChain. */
export const OG_NETWORK_PARAMS = {
  chainId: '0x' + OG_CHAIN_ID.toString(16),
  chainName: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: [OG_RPC_URL],
  blockExplorerUrls: [OG_EXPLORER],
};
