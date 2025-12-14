# Quick Start Guide

Get Royale Protocol up and running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment (Optional for local development)

Create a `.env` file in the root directory:

```env
# For testnet deployment
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_api_key_here

# For IPFS (optional)
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
```

## 3. Compile Contracts

```bash
npm run compile
```

## 4. Run Tests

```bash
npm test
```

You should see all tests passing! ✅

## 5. Start Local Network (Optional)

In one terminal:
```bash
npx hardhat node
```

In another terminal, deploy to local network:
```bash
npm run deploy:local
```

## 6. Use the SDK

### In a Node.js project:

```typescript
import { RoyaleProtocol } from "@royale-protocol/sdk";
import { BrowserProvider } from "ethers";

const protocol = new RoyaleProtocol(
  "0x...", // Contract address
  "https://sepolia.base.org"
);

await protocol.initializeIPFS();

// Connect wallet
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
await protocol.connectSigner(signer);

// Create a vault
const { vaultId, backupShare } = await protocol.createVault({
  secret: "your seed phrase",
  beneficiary: "0x...",
  inactivityDays: 180,
  graceDays: 30,
});
```

### In a React project:

```tsx
import { useRoyaleProtocol, useVault } from "@royale-protocol/react-hooks";

function App() {
  const { protocol, isConnected, connect } = useRoyaleProtocol({
    contractAddress: "0x...",
    rpcUrl: "https://sepolia.base.org",
  });

  const { vault, checkIn } = useVault({
    protocol,
    vaultId: 0n,
  });

  return (
    <div>
      {!isConnected && <button onClick={connect}>Connect Wallet</button>}
      {vault && <button onClick={checkIn}>Check In</button>}
    </div>
  );
}
```

## Next Steps

- Read [SETUP.md](./SETUP.md) for detailed setup instructions
- Check [EXAMPLES.md](./EXAMPLES.md) for more code examples
- Review [README.md](./README.md) for protocol documentation

## Troubleshooting

### "Cannot find module 'hardhat'"
Run `npm install` in the root directory.

### "Buffer is not defined" (browser)
The SDK includes a Buffer polyfill. Make sure you're importing from `@royale-protocol/sdk`.

### Contract deployment fails
- Check your `.env` file has the correct RPC URL
- Ensure you have enough ETH/gas for deployment
- Verify network configuration in `hardhat.config.ts`

## Building Packages

To build the SDK and React hooks:

```bash
npm run build
```

Or build individually:
```bash
cd packages/sdk && npm run build
cd packages/react-hooks && npm run build
```

