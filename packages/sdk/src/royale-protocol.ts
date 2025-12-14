import { Contract, JsonRpcProvider, BrowserProvider, Signer } from "ethers";
import {
  Vault,
  VaultStatus,
  VaultStatusInfo,
  CreateVaultParams,
  SecretShares,
} from "./types";
import {
  generateEncryptionKey,
  encryptAES,
  decryptAES,
  splitSecret,
  combineShares,
  encryptShareForRecipient,
} from "./encryption";
import { IPFSClient } from "./ipfs";

// ABI for RoyaleProtocol contract
const ROYALE_PROTOCOL_ABI = [
  "function createVault(address beneficiary, string memory ipfsCID, string memory encryptedTimelockKey, uint256 inactivityDays, uint256 graceDays) external returns (uint256)",
  "function checkIn(uint256 vaultId) external",
  "function triggerRecovery(uint256 vaultId) external",
  "function claimInheritance(uint256 vaultId) external returns (string memory, string memory)",
  "function cancelVault(uint256 vaultId) external",
  "function getVault(uint256 vaultId) external view returns (tuple(address owner, address beneficiary, string ipfsCID, string encryptedTimelockKey, uint256 inactivityPeriod, uint256 lastCheckIn, uint256 gracePeriod, uint256 triggerTime, uint8 status, uint256 createdAt))",
  "function getVaultStatus(uint256 vaultId) external view returns (uint8 status, uint256 timeUntilTrigger, bool canClaim, bool canTrigger)",
  "function getOwnerVaults(address owner) external view returns (uint256[])",
  "function getBeneficiaryVaults(address beneficiary) external view returns (uint256[])",
  "function totalVaults() external view returns (uint256)",
  "event VaultCreated(uint256 indexed vaultId, address indexed owner, address indexed beneficiary, uint256 inactivityPeriod, uint256 gracePeriod)",
  "event CheckIn(uint256 indexed vaultId, address indexed owner, uint256 timestamp)",
  "event VaultTriggered(uint256 indexed vaultId, address indexed triggerer, uint256 timestamp)",
  "event VaultClaimed(uint256 indexed vaultId, address indexed beneficiary, string ipfsCID, string encryptedTimelockKey)",
  "event VaultCancelled(uint256 indexed vaultId, address indexed owner)",
] as const;

/**
 * Main SDK class for interacting with Royale Protocol
 */
export class RoyaleProtocol {
  private contract: Contract;
  private provider: JsonRpcProvider | BrowserProvider;
  private signer: Signer | null = null;
  private ipfsClient: IPFSClient;

  /**
   * Initialize Royale Protocol SDK
   * @param contractAddress Contract address on the network
   * @param rpcUrl RPC URL for the network (or EIP-1193 provider for browser)
   * @param ipfsGatewayUrl IPFS gateway URL (optional)
   */
  constructor(contractAddress: string, rpcUrl: string | any, ipfsGatewayUrl?: string) {
    // Use JsonRpcProvider for RPC URLs, BrowserProvider for EIP-1193 providers
    if (typeof rpcUrl === "string") {
      this.provider = new JsonRpcProvider(rpcUrl);
    } else {
      this.provider = new BrowserProvider(rpcUrl);
    }
    this.contract = new Contract(contractAddress, ROYALE_PROTOCOL_ABI, this.provider);
    this.ipfsClient = new IPFSClient(ipfsGatewayUrl);
  }

  /**
   * Connect a signer (wallet) to the SDK
   * @param signer Ethers signer instance
   */
  async connectSigner(signer: Signer): Promise<void> {
    this.signer = signer;
    this.contract = this.contract.connect(signer) as Contract;
  }

  /**
   * Initialize IPFS client
   * @param ipfsUrl IPFS node URL (optional)
   * @param pinataApiKey Optional Pinata API key for direct uploads
   * @param pinataSecretKey Optional Pinata secret key for direct uploads
   */
  async initializeIPFS(
    ipfsUrl?: string,
    pinataApiKey?: string,
    pinataSecretKey?: string
  ): Promise<void> {
    await this.ipfsClient.initialize(ipfsUrl, pinataApiKey, pinataSecretKey);
  }

  /**
   * Create a new vault
   * @param params Vault creation parameters
   * @returns Vault ID and secret shares
   */
  async createVault(params: CreateVaultParams): Promise<{
    vaultId: bigint;
    shares: SecretShares;
    backupShare: string;
  }> {
    if (!this.signer) {
      throw new Error("Signer not connected. Call connectSigner() first.");
    }

    // Step 1: Generate encryption key and encrypt the secret
    const encryptionKey = generateEncryptionKey();
    const encryptedData = await encryptAES(params.secret, encryptionKey);

    // Step 2: Upload encrypted data to IPFS
    const ipfsCID = await this.ipfsClient.upload(encryptedData);

    // Step 3: Split the encryption key into shares
    const shares = splitSecret(encryptionKey);

    // Step 4: Encrypt timelock share for beneficiary
    // Get beneficiary's public key (simplified - in production, derive from address)
    const beneficiaryPublicKey = params.beneficiary; // Placeholder
    const encryptedTimelockKey = await encryptShareForRecipient(
      shares.timelockShare,
      beneficiaryPublicKey
    );

    // Step 5: Create vault on-chain
    const tx = await this.contract.createVault(
      params.beneficiary,
      ipfsCID,
      encryptedTimelockKey,
      params.inactivityDays,
      params.graceDays
    );

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }
    
    const eventInterface = this.contract.interface.getEvent("VaultCreated");
    if (!eventInterface) {
      throw new Error("VaultCreated event interface not found");
    }
    
    const event = receipt.logs.find(
      (log: any) => log.topics[0] === eventInterface.topicHash
    );

    if (!event) {
      throw new Error("VaultCreated event not found");
    }

    const decoded = this.contract.interface.decodeEventLog("VaultCreated", event.data, event.topics);
    const vaultId = decoded.vaultId;

    return {
      vaultId,
      shares,
      backupShare: shares.backupShare,
    };
  }

  /**
   * Owner check-in to prove they're alive
   * @param vaultId Vault ID
   */
  async checkIn(vaultId: bigint): Promise<void> {
    if (!this.signer) {
      throw new Error("Signer not connected");
    }

    const tx = await this.contract.checkIn(vaultId);
    await tx.wait();
  }

  /**
   * Trigger recovery if inactivity period has passed
   * @param vaultId Vault ID
   */
  async triggerRecovery(vaultId: bigint): Promise<void> {
    const tx = await this.contract.triggerRecovery(vaultId);
    await tx.wait();
  }

  /**
   * Beneficiary claims the inheritance
   * @param vaultId Vault ID
   * @param beneficiaryShare Share that beneficiary received when vault was created
   * @returns Decrypted secret
   */
  async claimInheritance(
    vaultId: bigint,
    beneficiaryShare: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error("Signer not connected");
    }

    // First, get the return values using staticCall
    const staticResult = await this.contract.claimInheritance.staticCall(vaultId);
    let ipfsCID: string;
    let encryptedTimelockKey: string;
    
    if (Array.isArray(staticResult)) {
      ipfsCID = staticResult[0];
      encryptedTimelockKey = staticResult[1];
    } else {
      ipfsCID = (staticResult as any).ipfsCID || (staticResult as any)[0];
      encryptedTimelockKey = (staticResult as any).encryptedTimelockKey || (staticResult as any)[1];
    }

    if (!ipfsCID || !encryptedTimelockKey) {
      throw new Error(`Failed to get claim data from static call`);
    }

    // Now execute the actual transaction
    const tx = await this.contract.claimInheritance(vaultId);
    await tx.wait();

    // Decrypt timelock share (in production, use beneficiary's private key)
    // For now, the encryptedTimelockKey is the share itself (not encrypted in this implementation)
    const timelockShare = encryptedTimelockKey;

    // Combine shares to get encryption key
    const encryptionKey = combineShares([beneficiaryShare, timelockShare]);

    // Retrieve encrypted data from IPFS
    const encryptedData = await this.ipfsClient.retrieve(ipfsCID);

    // Decrypt the secret
    const secret = await decryptAES(encryptedData, encryptionKey);

    return secret;
  }

  /**
   * Owner cancels the vault
   * @param vaultId Vault ID
   */
  async cancelVault(vaultId: bigint): Promise<void> {
    if (!this.signer) {
      throw new Error("Signer not connected");
    }

    const tx = await this.contract.cancelVault(vaultId);
    await tx.wait();
  }

  /**
   * Get vault details
   * @param vaultId Vault ID
   * @returns Vault data
   */
  async getVault(vaultId: bigint): Promise<Vault> {
    const vault = await this.contract.getVault(vaultId);
    return {
      owner: vault.owner,
      beneficiary: vault.beneficiary,
      ipfsCID: vault.ipfsCID,
      encryptedTimelockKey: vault.encryptedTimelockKey,
      inactivityPeriod: vault.inactivityPeriod,
      lastCheckIn: vault.lastCheckIn,
      gracePeriod: vault.gracePeriod,
      triggerTime: vault.triggerTime,
      status: vault.status as VaultStatus,
      createdAt: vault.createdAt,
    };
  }

  /**
   * Get vault status information
   * @param vaultId Vault ID
   * @returns Status information
   */
  async getVaultStatus(vaultId: bigint): Promise<VaultStatusInfo> {
    const [status, timeUntilTrigger, canClaim, canTrigger] =
      await this.contract.getVaultStatus(vaultId);

    return {
      status: status as VaultStatus,
      timeUntilTrigger,
      canClaim,
      canTrigger,
    };
  }

  /**
   * Get all vault IDs for an owner
   * @param ownerAddress Owner address
   * @returns Array of vault IDs
   */
  async getOwnerVaults(ownerAddress: string): Promise<bigint[]> {
    return await this.contract.getOwnerVaults(ownerAddress);
  }

  /**
   * Get all vault IDs for a beneficiary
   * @param beneficiaryAddress Beneficiary address
   * @returns Array of vault IDs
   */
  async getBeneficiaryVaults(beneficiaryAddress: string): Promise<bigint[]> {
    return await this.contract.getBeneficiaryVaults(beneficiaryAddress);
  }

  /**
   * Get total number of vaults
   * @returns Total vault count
   */
  async totalVaults(): Promise<bigint> {
    return await this.contract.totalVaults();
  }
}

