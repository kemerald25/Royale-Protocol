# Browser & Next.js Compatibility

The `@devroyale/protocol` SDK is fully compatible with browser environments and Next.js without any configuration.

## How It Works

### IPFS Client

The SDK uses a smart fallback system for IPFS:

1. **Pinata API** (if credentials provided) - Works in both browser and Node.js
2. **Local Storage Fallback** - For testing and development
3. **Gateway-Only Mode** - For reading from IPFS without upload capability

### No Configuration Required

The SDK works out of the box:

```typescript
import { RoyaleProtocol } from "@devroyale/protocol";
import { BrowserProvider } from "ethers";

// Works immediately - no IPFS setup needed
const protocol = new RoyaleProtocol(
  "0x...", // contract address
  window.ethereum // or RPC URL
);

// Optional: Add Pinata for production uploads
await protocol.initializeIPFS(
  undefined,
  "your-pinata-api-key",
  "your-pinata-secret-key"
);
```

### What Changed

- **Removed top-level import** of `ipfs-http-client` (ESM-only, breaks webpack)
- **Made `ipfs-http-client` optional** - only used in Node.js if explicitly configured
- **Default to Pinata API** or local storage fallback
- **Works in browser** without any bundler configuration

### For Production

To enable IPFS uploads in production, provide Pinata credentials:

```typescript
await protocol.initializeIPFS(
  undefined, // IPFS node URL (optional)
  process.env.PINATA_API_KEY,
  process.env.PINATA_SECRET_KEY
);
```

Without Pinata credentials, the SDK will:
- ✅ Work for reading from IPFS (via gateway)
- ✅ Work for local testing (local storage fallback)
- ⚠️ Use local storage for uploads (not persistent across sessions)

