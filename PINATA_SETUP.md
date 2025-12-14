# Pinata IPFS Setup

To upload files to Pinata and see them in your dashboard, you need to configure your Pinata API credentials.

## Getting Pinata API Keys

1. Go to [Pinata](https://pinata.cloud) and sign up/login
2. Navigate to **API Keys** in your dashboard
3. Click **New Key**
4. Give it a name (e.g., "Royale Protocol")
5. Select permissions: **Pin File To IPFS**
6. Copy the **API Key** and **Secret Key**

## Configuration

Add your Pinata credentials to your `.env` file:

```env
PINATA_API_KEY=your_pinata_api_key_here
PINATA_SECRET_KEY=your_pinata_secret_key_here
```

## Usage

Once configured, the SDK will automatically use Pinata API for uploads:

```typescript
const protocol = new RoyaleProtocol(
  contractAddress,
  rpcUrl,
  "https://red-famous-peafowl-148.mypinata.cloud/ipfs/"
);

// Initialize with Pinata credentials
await protocol.initializeIPFS(
  undefined, // IPFS node URL (optional)
  process.env.PINATA_API_KEY,
  process.env.PINATA_SECRET_KEY
);

// Now all uploads will go to Pinata and appear in your dashboard
const { vaultId } = await protocol.createVault({
  secret: "your secret",
  beneficiary: "0x...",
  inactivityDays: 180,
  graceDays: 30,
});
```

## Testing

Run the test flow with Pinata:

```bash
# Make sure .env has PINATA_API_KEY and PINATA_SECRET_KEY
npm run test:flow
```

Files uploaded will appear in your Pinata dashboard under **Files**.

## Gateway

Your Pinata gateway is already configured:
- Gateway URL: `https://red-famous-peafowl-148.mypinata.cloud/ipfs/`

This gateway is used for retrieving files from IPFS.

