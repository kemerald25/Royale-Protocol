# @royale-protocol/sdk

TypeScript SDK for Royale Protocol - Decentralized Timelock Encryption Infrastructure for Web3

## Installation

```bash
npm install @royale-protocol/sdk ethers
```

## Usage

```typescript
import { RoyaleProtocol } from "@royale-protocol/sdk";
import { BrowserProvider } from "ethers";

// Initialize
const protocol = new RoyaleProtocol(
  "0x...", // Contract address
  "https://sepolia.base.org" // RPC URL
);

// Connect wallet
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
await protocol.connectSigner(signer);

// Create vault
const { vaultId, backupShare } = await protocol.createVault({
  secret: "your seed phrase",
  beneficiary: "0x...",
  inactivityDays: 180,
  graceDays: 30,
});
```

See [EXAMPLES.md](../../EXAMPLES.md) for more usage examples.

