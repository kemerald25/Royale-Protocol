# Royale Protocol (RP)
**Decentralized Timelock Encryption Infrastructure for Web3**

Version 1.0 | Base Chain | Open Source (MIT License)

## Overview

Royale Protocol (RP) is an open-source infrastructure layer that enables any Web3 application to add timelock encryption and dead man's switch functionality. Built on Base, RP allows developers to implement secure inheritance, recovery, and time-delayed access features without building cryptographic infrastructure from scratch.

## What is Royale Protocol?

Royale Protocol provides a standardized, composable framework for encrypting sensitive data (seed phrases, private keys, documents) that can only be decrypted after:

- A specified time period has elapsed (timelock)
- The owner becomes inactive for a configured duration (dead man's switch)
- A combination of both conditions are met (hybrid mode)

## Core Use Cases

### For Wallet Developers:
- Add inheritance features to your wallet
- Enable social recovery mechanisms
- Provide emergency access options

### For DAO Tooling:
- Implement treasury key recovery
- Create succession plans for multisig signers
- Automate protocol admin key rotation

### For Applications:
- Build time-capsule features (NFTs that reveal over time)
- Create escrow mechanisms with time-based release
- Implement dead man's switches for sensitive operations

### For Users:
- Ensure crypto assets aren't lost forever
- Create digital wills for beneficiaries
- Set up emergency access for trusted contacts

## How It Works

### Architecture Overview

Royale Protocol uses a three-layer architecture:

1. **Application Layer** (Wallets, DAOs, Apps integrate here)
2. **RP SDK** (TypeScript/React libraries)
3. **Smart Contracts** (Base Chain, Immutable timelock logic)

### The Encryption Flow

#### 1. Secret Splitting (Shamir Secret Sharing)

When you create a vault, your secret (seed phrase) is encrypted and the encryption key is split into multiple shares. The master encryption key is split into three shares: one for the beneficiary (given immediately), one timelock share (locked), and one for the owner (backup). The threshold requires any two of the three shares to decrypt.

#### 2. Encryption & Storage

The encryption happens client-side in the browser using AES. The encrypted data is then uploaded to IPFS for permanent, decentralized storage, resulting in a content identifier (CID). Finally, metadata is stored on-chain via the smart contract, including the beneficiary, CID, encrypted timelock key, and inactivity period.

#### 3. The Timelock Mechanism

The owner creates the vault and distributes the shares: the beneficiary receives their share (useless alone), the timelock share is locked in the smart contract, and the owner keeps the backup. The owner maintains activity through periodic check-ins. If a set number of days pass with no activity (e.g., 180 days), anyone can trigger recovery. This starts a grace period (e.g., 30 days). If the owner doesn't respond during this time, the beneficiary can claim the timelock key from the contract and combine it with their own share to decrypt the secret.

## Security Model

### Why This is Secure:

#### No Single Point of Failure
- Beneficiary has one share but can't decrypt (needs the timelock share)
- Smart contract has the timelock share but doesn't know the beneficiary's share
- Owner has a backup share as emergency
- Encrypted file on IPFS is useless without keys

#### Time-Based Protection
- Timelock share only releases after inactivity period plus grace period
- Owner can cancel anytime before beneficiary claims
- All actions are transparent on-chain

#### Privacy Preserved
- Seed phrase never touches blockchain
- Encrypted file stored off-chain (IPFS)
- Only parties with keys can decrypt

#### Trustless Execution
- No third parties hold keys
- Smart contract enforces rules automatically
- Beneficiary can't claim early (cryptographically impossible)

## Protocol Concepts

### Vault Types

#### 1. Activity-Based Vault (Dead Man's Switch)
- **Trigger condition:** Owner inactive for a set number of days
- **Use case:** Crypto inheritance, emergency access
- **Check-in method:** Manual or automatic on-chain activity

#### 2. Time-Based Vault (Timelock)
- **Trigger condition:** Specific date/time reached
- **Use case:** Trust funds, time capsules, scheduled reveals
- **Check-in:** Not required (unlocks on schedule)

#### 3. Hybrid Vault
- **Trigger condition:** Time reached or inactivity period
- **Use case:** Flexible inheritance with guaranteed unlock date
- **Check-in:** Optional (whichever condition comes first)

### Key Components

#### Vault Creator (Owner)
- Creates the vault with encrypted data
- Sets beneficiary and unlock conditions
- Maintains activity through check-ins
- Can cancel vault anytime before claim

#### Beneficiary
- Receives partial decryption key immediately
- Monitors vault status
- Claims timelock key after conditions are met
- Combines keys to decrypt the secret

#### Guardian (Optional)
- Trusted third party who can pause claims
- Cannot access funds or decrypt secrets
- Provides extra protection against malicious claims
- Can be a 2-of-3 or 3-of-5 multisig

#### Smart Contract
- Stores vault metadata and timelock key
- Enforces timelock and inactivity rules
- Releases timelock key when conditions are met
- Transparent and auditable

## Technical Specification

### Smart Contract Interface

The interface defines a `Vault` struct with fields for owner, beneficiary, encrypted data CID (IPFS hash), timelock key (encrypted for beneficiary), inactivity period (seconds), last check-in timestamp, grace period (seconds), and status.

Vault status can be `Active`, `Triggered`, `Claimed`, or `Cancelled`.

**Functions include:**
- Create a new vault with beneficiary, IPFS CID, encrypted key, inactivity days, and grace days; returns vault ID.
- Owner check-in to prove they're alive.
- Anyone can trigger recovery if conditions are met.
- Beneficiary claims key after grace period; returns IPFS CID and decryption key.
- Owner cancels vault.
- View vault status, including status, time until trigger, and whether it can be claimed.

### SDK Usage

The SDK is initialized with chain and RPC URL. Owners can create vaults by providing the secret, beneficiary, inactivity days, and grace days. They can also check in. Anyone can monitor status, which includes owner, beneficiary, last check-in, days until trigger, and status. Beneficiaries can claim the inheritance if claimable, recovering the secret.

### React Integration

React hooks provide access to vaults, creation, and check-in functions. This enables building dashboards that list vaults with beneficiary, last check-in, status, and check-in buttons when needed.

## Integration Guide

### 5-Minute Integration

Add vault functionality to your application in minutes:

**Step 1: Install**
Install the SDK via npm.

**Step 2: Initialize**
Import and initialize the RoyaleProtocol with the chain.

**Step 3: Create Vault**
When a user wants to set up inheritance, create a vault with the secret from the wallet, beneficiary address, and inactivity days.

**Step 4: Auto Check-In**
Hook into existing wallet activity, such as transactions, to automatically perform check-ins.

That's it! Your users now have inheritance protection.

### Advanced Integration Examples

#### Wallet Provider Integration
In wallet settings, enable inheritance by creating a vault with the seed phrase, beneficiary, and inactivity days. Set up auto check-ins on any wallet activity.

#### DAO Treasury Recovery
For multi-sig with recovery, set up a vault with the treasury private key, backup multisig address as beneficiary, and a longer inactivity period like 365 days.

#### Time-Capsule NFT
Mint NFTs with timelock by creating a timelock vault with the content, NFT owner as beneficiary, and unlock date. Mint the NFT with the vault ID and a placeholder description.

## Security Considerations

### Cryptographic Primitives

#### Shamir Secret Sharing
- Uses a standard implementation
- Threshold: 2-of-3 by default (configurable)
- Information-theoretic security
- Individual shares reveal nothing

#### Encryption
- AES-256-GCM for seed phrase encryption
- Client-side encryption (never sent unencrypted)
- Nonce generated with cryptographic randomness

#### Key Storage
- First share: Encrypted with beneficiary's public key
- Timelock share: Stored on-chain, encrypted for beneficiary
- Backup share: User stores locally (paper backup recommended)

### Attack Vectors & Mitigations

#### 1. Beneficiary Tries to Decrypt Early
- **Blocked:** Needs timelock share which is locked in contract
- Can't brute force: Massive keyspace

#### 2. Malicious Trigger Attempt
- Grace period gives owner time to cancel
- All triggers are public events (owner gets notified)
- Owner can always cancel before claim

#### 3. Smart Contract Exploit
- Audited by a professional firm
- Formal verification of time-lock logic
- Immutable contracts (no admin keys)
- Bug bounty program with substantial rewards

#### 4. IPFS Data Loss
- Pinned on multiple providers (Pinata, Infura, Filebase)
- Arweave backup (permanent storage)
- Users can re-upload and update CID

#### 5. Key Compromise
- First share stolen: Still need timelock share (time-locked)
- Timelock share stolen: Still need first share (beneficiary has it)
- Backup share stolen: Owner can create new vault
- All three stolen: Same as original seed phrase compromise

### Best Practices

**For Developers:**
- Always encrypt timelock share with beneficiary's public key
- Validate all inputs in your integration
- Test with testnet first (Base Sepolia)
- Implement proper error handling
- Use environment variables for sensitive config

**For Users:**
- Store backup share securely (paper wallet, safe)
- Use strong, unique beneficiary addresses
- Set realistic inactivity periods (6-12 months)
- Check in regularly if not actively using wallet
- Keep beneficiary contact info updated

## Roadmap

### Phase 1: Foundation (Complete)
- Core smart contracts
- TypeScript SDK
- Documentation
- Base mainnet deployment

### Phase 2: Ecosystem (Current)
- React hooks library
- First wallet integrations (Privy, Dynamic)
- Security audit
- Bug bounty launch

### Phase 3: Growth (Q2 2025)
- 10+ production integrations
- Mobile SDK (React Native)
- Multi-chain support (OP Stack)
- Advanced features (conditional logic, NFT timelocks)

### Phase 4: Decentralization (Q3 2025)
- DAO governance
- Protocol token ($RP)
- Community grants program
- Protocol fee mechanism

## FAQ

**Q: Is this a product or a protocol?**  
A: Protocol. We provide infrastructure that developers integrate into their applications. We don't have a consumer-facing product.

**Q: What blockchains does this support?**  
A: Currently Base (Ethereum L2). Expanding to other OP Stack chains in Q2 2025.

**Q: How much does it cost to use?**  
A: The protocol is free and open source. Gas costs for transactions apply (~$1-5 on Base). Developers can choose to charge their users or subsidize costs.

**Q: What happens if I lose my backup key?**  
A: You can still recover using the beneficiary's share plus the timelock share (after expiration), but you'll need cooperation from your beneficiary. This is why we recommend storing the backup share securely.

**Q: Can the beneficiary see my seed phrase before the timelock expires?**  
A: No. The seed phrase is encrypted, and they only have one share. Without the timelock share (locked in the contract), the encrypted file is mathematically impossible to decrypt.

**Q: What if I want to change my beneficiary?**  
A: Cancel the existing vault and create a new one with the new beneficiary. The old beneficiary's share becomes useless.

**Q: Is there a token?**  
A: Not yet, as this is built as infrastructure rather than a product. A protocol token ($RP) is planned for Phase 4 to support decentralization and governance.
