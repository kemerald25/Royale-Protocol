/**
 * Vault status enum matching the smart contract
 */
export enum VaultStatus {
  Active = 0,
  Triggered = 1,
  Claimed = 2,
  Cancelled = 3,
}

/**
 * Vault data structure
 */
export interface Vault {
  owner: string;
  beneficiary: string;
  ipfsCID: string;
  encryptedTimelockKey: string;
  inactivityPeriod: bigint;
  lastCheckIn: bigint;
  gracePeriod: bigint;
  triggerTime: bigint;
  status: VaultStatus;
  createdAt: bigint;
}

/**
 * Vault status information
 */
export interface VaultStatusInfo {
  status: VaultStatus;
  timeUntilTrigger: bigint;
  canClaim: boolean;
  canTrigger: boolean;
}

/**
 * Secret shares for Shamir Secret Sharing
 */
export interface SecretShares {
  beneficiaryShare: string; // Share given to beneficiary immediately
  timelockShare: string; // Share locked in contract
  backupShare: string; // Share kept by owner
}

/**
 * Encryption result
 */
export interface EncryptionResult {
  encryptedData: string; // AES encrypted data
  key: string; // Master encryption key (to be split)
}

/**
 * Create vault parameters
 */
export interface CreateVaultParams {
  secret: string; // The secret to encrypt (e.g., seed phrase)
  beneficiary: string; // Beneficiary address
  inactivityDays: number; // Days of inactivity before trigger
  graceDays: number; // Days after trigger before claim
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  contractAddress?: string;
}

