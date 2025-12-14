// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RoyaleProtocol
 * @notice Decentralized Timelock Encryption Infrastructure for Web3
 * @dev Manages vaults with timelock and dead man's switch functionality
 */
contract RoyaleProtocol {
    /// @notice Enum for vault status
    enum VaultStatus {
        Active,
        Triggered,
        Claimed,
        Cancelled
    }

    /// @notice Vault structure
    struct Vault {
        address owner;
        address beneficiary;
        string ipfsCID; // IPFS content identifier for encrypted data
        string encryptedTimelockKey; // Encrypted timelock key (for beneficiary)
        uint256 inactivityPeriod; // Seconds of inactivity before trigger
        uint256 lastCheckIn; // Timestamp of last check-in
        uint256 gracePeriod; // Seconds after trigger before claim is allowed
        uint256 triggerTime; // Timestamp when vault was triggered (0 if not triggered)
        VaultStatus status;
        uint256 createdAt;
    }

    /// @notice Mapping from vault ID to vault data
    mapping(uint256 => Vault) public vaults;

    /// @notice Mapping from owner to their vault IDs
    mapping(address => uint256[]) public ownerVaults;

    /// @notice Mapping from beneficiary to their vault IDs
    mapping(address => uint256[]) public beneficiaryVaults;

    /// @notice Counter for vault IDs
    uint256 private _vaultCounter;

    /// @notice Events
    event VaultCreated(
        uint256 indexed vaultId,
        address indexed owner,
        address indexed beneficiary,
        uint256 inactivityPeriod,
        uint256 gracePeriod
    );

    event CheckIn(uint256 indexed vaultId, address indexed owner, uint256 timestamp);

    event VaultTriggered(uint256 indexed vaultId, address indexed triggerer, uint256 timestamp);

    event VaultClaimed(
        uint256 indexed vaultId,
        address indexed beneficiary,
        string ipfsCID,
        string encryptedTimelockKey
    );

    event VaultCancelled(uint256 indexed vaultId, address indexed owner);

    /// @notice Modifier to check if vault exists
    modifier vaultExists(uint256 vaultId) {
        require(vaults[vaultId].owner != address(0), "Vault does not exist");
        _;
    }

    /// @notice Modifier to check if caller is vault owner
    modifier onlyOwner(uint256 vaultId) {
        require(vaults[vaultId].owner == msg.sender, "Not vault owner");
        _;
    }

    /// @notice Modifier to check if caller is vault beneficiary
    modifier onlyBeneficiary(uint256 vaultId) {
        require(vaults[vaultId].beneficiary == msg.sender, "Not vault beneficiary");
        _;
    }

    /**
     * @notice Create a new vault
     * @param beneficiary Address that will receive the timelock key after conditions are met
     * @param ipfsCID IPFS content identifier for the encrypted data
     * @param encryptedTimelockKey Encrypted timelock key (encrypted with beneficiary's public key)
     * @param inactivityDays Number of days of inactivity before trigger
     * @param graceDays Number of days after trigger before claim is allowed
     * @return vaultId The ID of the newly created vault
     */
    function createVault(
        address beneficiary,
        string memory ipfsCID,
        string memory encryptedTimelockKey,
        uint256 inactivityDays,
        uint256 graceDays
    ) external returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(beneficiary != msg.sender, "Cannot be your own beneficiary");
        require(bytes(ipfsCID).length > 0, "IPFS CID required");
        require(bytes(encryptedTimelockKey).length > 0, "Encrypted key required");
        require(inactivityDays > 0, "Inactivity period must be > 0");
        require(graceDays > 0, "Grace period must be > 0");

        uint256 vaultId = _vaultCounter++;
        uint256 currentTime = block.timestamp;

        vaults[vaultId] = Vault({
            owner: msg.sender,
            beneficiary: beneficiary,
            ipfsCID: ipfsCID,
            encryptedTimelockKey: encryptedTimelockKey,
            inactivityPeriod: inactivityDays * 1 days,
            lastCheckIn: currentTime,
            gracePeriod: graceDays * 1 days,
            triggerTime: 0,
            status: VaultStatus.Active,
            createdAt: currentTime
        });

        ownerVaults[msg.sender].push(vaultId);
        beneficiaryVaults[beneficiary].push(vaultId);

        emit VaultCreated(vaultId, msg.sender, beneficiary, inactivityDays, graceDays);

        return vaultId;
    }

    /**
     * @notice Owner check-in to prove they're alive
     * @param vaultId The ID of the vault to check in for
     */
    function checkIn(uint256 vaultId) external vaultExists(vaultId) onlyOwner(vaultId) {
        Vault storage vault = vaults[vaultId];
        require(
            vault.status == VaultStatus.Active || vault.status == VaultStatus.Triggered,
            "Vault not active"
        );

        vault.lastCheckIn = block.timestamp;

        // If vault was triggered, reset it back to active
        if (vault.status == VaultStatus.Triggered) {
            vault.status = VaultStatus.Active;
            vault.triggerTime = 0;
        }

        emit CheckIn(vaultId, msg.sender, block.timestamp);
    }

    /**
     * @notice Trigger recovery if inactivity period has passed
     * @param vaultId The ID of the vault to trigger
     */
    function triggerRecovery(uint256 vaultId) external vaultExists(vaultId) {
        Vault storage vault = vaults[vaultId];
        require(vault.status == VaultStatus.Active, "Vault not active");
        require(
            block.timestamp >= vault.lastCheckIn + vault.inactivityPeriod,
            "Inactivity period not met"
        );

        vault.status = VaultStatus.Triggered;
        vault.triggerTime = block.timestamp;

        emit VaultTriggered(vaultId, msg.sender, block.timestamp);
    }

    /**
     * @notice Beneficiary claims the timelock key after grace period
     * @param vaultId The ID of the vault to claim
     * @return ipfsCID The IPFS CID of the encrypted data
     * @return encryptedTimelockKey The encrypted timelock key
     */
    function claimInheritance(
        uint256 vaultId
    )
        external
        vaultExists(vaultId)
        onlyBeneficiary(vaultId)
        returns (string memory ipfsCID, string memory encryptedTimelockKey)
    {
        Vault storage vault = vaults[vaultId];
        require(vault.status == VaultStatus.Triggered, "Vault not triggered");
        require(
            block.timestamp >= vault.triggerTime + vault.gracePeriod,
            "Grace period not elapsed"
        );

        vault.status = VaultStatus.Claimed;

        emit VaultClaimed(vaultId, msg.sender, vault.ipfsCID, vault.encryptedTimelockKey);

        return (vault.ipfsCID, vault.encryptedTimelockKey);
    }

    /**
     * @notice Owner cancels the vault before beneficiary claims
     * @param vaultId The ID of the vault to cancel
     */
    function cancelVault(uint256 vaultId) external vaultExists(vaultId) onlyOwner(vaultId) {
        Vault storage vault = vaults[vaultId];
        require(
            vault.status == VaultStatus.Active || vault.status == VaultStatus.Triggered,
            "Cannot cancel vault"
        );
        require(vault.status != VaultStatus.Claimed, "Already claimed");

        vault.status = VaultStatus.Cancelled;

        emit VaultCancelled(vaultId, msg.sender);
    }

    /**
     * @notice Get vault details
     * @param vaultId The ID of the vault
     * @return vault The vault data
     */
    function getVault(uint256 vaultId) external view vaultExists(vaultId) returns (Vault memory) {
        return vaults[vaultId];
    }

    /**
     * @notice Get vault status information
     * @param vaultId The ID of the vault
     * @return status Current vault status
     * @return timeUntilTrigger Seconds until trigger (0 if already triggered or not applicable)
     * @return canClaim Whether beneficiary can claim now
     * @return canTrigger Whether recovery can be triggered now
     */
    function getVaultStatus(
        uint256 vaultId
    )
        external
        view
        vaultExists(vaultId)
        returns (
            VaultStatus status,
            uint256 timeUntilTrigger,
            bool canClaim,
            bool canTrigger
        )
    {
        Vault memory vault = vaults[vaultId];

        status = vault.status;

        if (vault.status == VaultStatus.Active) {
            uint256 nextTriggerTime = vault.lastCheckIn + vault.inactivityPeriod;
            if (block.timestamp < nextTriggerTime) {
                timeUntilTrigger = nextTriggerTime - block.timestamp;
            }
            canTrigger = block.timestamp >= nextTriggerTime;
            canClaim = false;
        } else if (vault.status == VaultStatus.Triggered) {
            timeUntilTrigger = 0;
            canTrigger = false;
            canClaim = block.timestamp >= vault.triggerTime + vault.gracePeriod;
        } else {
            timeUntilTrigger = 0;
            canTrigger = false;
            canClaim = false;
        }
    }

    /**
     * @notice Get all vault IDs for an owner
     * @param owner The owner address
     * @return Array of vault IDs
     */
    function getOwnerVaults(address owner) external view returns (uint256[] memory) {
        return ownerVaults[owner];
    }

    /**
     * @notice Get all vault IDs for a beneficiary
     * @param beneficiary The beneficiary address
     * @return Array of vault IDs
     */
    function getBeneficiaryVaults(address beneficiary) external view returns (uint256[] memory) {
        return beneficiaryVaults[beneficiary];
    }

    /**
     * @notice Get total number of vaults
     * @return Total vault count
     */
    function totalVaults() external view returns (uint256) {
        return _vaultCounter;
    }
}

