/**
 * @deprecated Storage moved from Pinata IPFS to 0G Storage.
 * This file is a thin compatibility shim that re-exports the 0G Storage
 * functions under the legacy names so older imports keep working.
 * Prefer importing from '@/lib/og/storage' directly.
 */
export {
  uploadSkillToOG as uploadSkillToIPFS,
  fetchSkillFromOG as fetchSkillFromIPFS,
} from './og/storage';
