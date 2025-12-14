# @royale-protocol/react-hooks

React hooks for Royale Protocol integration

## Installation

```bash
npm install @devroyale/react-hooks @devroyale/protocol react ethers
```

## Usage

```tsx
import { useRoyaleProtocol, useVault } from "@devroyale/react-hooks";

function App() {
  const { protocol, isConnected, connect } = useRoyaleProtocol({
    contractAddress: "0x...",
    rpcUrl: "https://sepolia.base.org",
  });

  const { vault, checkIn } = useVault({
    protocol,
    vaultId: 0n,
    autoRefresh: true,
  });

  return (
    <div>
      {!isConnected && <button onClick={connect}>Connect</button>}
      {vault && <button onClick={checkIn}>Check In</button>}
    </div>
  );
}
```

See [EXAMPLES.md](../../EXAMPLES.md) for more usage examples.

