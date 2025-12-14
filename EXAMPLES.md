# Royale Protocol Examples

## Smart Contract Usage

### Deploy Contract

```bash
# Deploy to local network
npm run deploy:local

# Deploy to Base Sepolia testnet
npm run deploy:base-sepolia

# Deploy to Base mainnet
npm run deploy:base
```

### Run Tests

```bash
npm test
```

## SDK Usage

### Basic Setup

```typescript
import { RoyaleProtocol } from "@royale-protocol/sdk";
import { BrowserProvider } from "ethers";

// Initialize SDK
const protocol = new RoyaleProtocol(
  "0x...", // Contract address
  "https://sepolia.base.org", // RPC URL
  "https://red-famous-peafowl-148.mypinata.cloud/ipfs/" // IPFS gateway (optional)
);

// Initialize IPFS
await protocol.initializeIPFS();

// Connect wallet
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
await protocol.connectSigner(signer);
```

### Create a Vault

```typescript
const { vaultId, shares, backupShare } = await protocol.createVault({
  secret: "your seed phrase here",
  beneficiary: "0x...", // Beneficiary address
  inactivityDays: 180,
  graceDays: 30,
});

// IMPORTANT: Store backupShare securely (paper wallet, safe, etc.)
console.log("Backup share:", backupShare);
```

### Check In

```typescript
// Owner checks in to prove they're alive
await protocol.checkIn(vaultId);
```

### Trigger Recovery

```typescript
// Anyone can trigger if inactivity period has passed
await protocol.triggerRecovery(vaultId);
```

### Claim Inheritance

```typescript
// Beneficiary claims after grace period
const secret = await protocol.claimInheritance(
  vaultId,
  beneficiaryShare // Share received when vault was created
);

console.log("Recovered secret:", secret);
```

### Get Vault Status

```typescript
const vault = await protocol.getVault(vaultId);
const status = await protocol.getVaultStatus(vaultId);

console.log("Status:", status.status);
console.log("Can claim:", status.canClaim);
console.log("Time until trigger:", status.timeUntilTrigger);
```

## React Hooks Usage

### Setup Provider

```tsx
import { useRoyaleProtocol } from "@royale-protocol/react-hooks";

function App() {
  const { protocol, isConnected, connect, error } = useRoyaleProtocol({
    contractAddress: "0x...",
    rpcUrl: "https://sepolia.base.org",
  });

  return (
    <div>
      {!isConnected ? (
        <button onClick={connect}>Connect Wallet</button>
      ) : (
        <VaultManager protocol={protocol} />
      )}
    </div>
  );
}
```

### Create and Manage Vault

```tsx
import { useVault } from "@royale-protocol/react-hooks";

function VaultManager({ protocol }) {
  const [vaultId, setVaultId] = useState<bigint | null>(null);

  const { vault, status, loading, checkIn, createVault } = useVault({
    protocol,
    vaultId,
    autoRefresh: true,
  });

  const handleCreateVault = async () => {
    const result = await protocol.createVault({
      secret: "seed phrase",
      beneficiary: "0x...",
      inactivityDays: 180,
      graceDays: 30,
    });
    setVaultId(result.vaultId);
  };

  return (
    <div>
      {vault && (
        <>
          <p>Status: {status?.status}</p>
          <p>Last check-in: {new Date(Number(vault.lastCheckIn) * 1000).toLocaleString()}</p>
          {status?.canTrigger && (
            <button onClick={() => protocol.triggerRecovery(vaultId!)}>
              Trigger Recovery
            </button>
          )}
          <button onClick={checkIn}>Check In</button>
        </>
      )}
    </div>
  );
}
```

### List All Vaults

```tsx
import { useVaults } from "@royale-protocol/react-hooks";

function MyVaults({ protocol, address }) {
  const { vaults, loading } = useVaults({
    protocol,
    address,
    type: "owner",
    autoRefresh: true,
  });

  return (
    <div>
      {vaults.map((vault, index) => (
        <div key={index}>
          <p>Vault ID: {vault.id}</p>
          <p>Beneficiary: {vault.beneficiary}</p>
          <p>Status: {vault.status}</p>
        </div>
      ))}
    </div>
  );
}
```

## Integration Examples

### Wallet Integration

```typescript
// In wallet settings
async function enableInheritance(seedPhrase: string, beneficiary: string) {
  const protocol = new RoyaleProtocol(CONTRACT_ADDRESS, RPC_URL);
  await protocol.initializeIPFS();
  await protocol.connectSigner(walletSigner);

  const { vaultId, backupShare } = await protocol.createVault({
    secret: seedPhrase,
    beneficiary,
    inactivityDays: 180,
    graceDays: 30,
  });

  // Store backup share securely
  saveBackupShare(backupShare);

  // Auto check-in on wallet activity
  wallet.on("transaction", () => {
    protocol.checkIn(vaultId);
  });
}
```

### DAO Treasury Recovery

```typescript
async function setupTreasuryRecovery(treasuryKey: string, backupMultisig: string) {
  const protocol = new RoyaleProtocol(CONTRACT_ADDRESS, RPC_URL);
  await protocol.initializeIPFS();
  await protocol.connectSigner(daoSigner);

  await protocol.createVault({
    secret: treasuryKey,
    beneficiary: backupMultisig,
    inactivityDays: 365, // 1 year
    graceDays: 60, // 2 months grace period
  });
}
```

