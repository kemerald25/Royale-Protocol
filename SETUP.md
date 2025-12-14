# Royale Protocol Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Git

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Royale-Protocol
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Development

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Start Local Hardhat Network

```bash
npx hardhat node
```

### Deploy to Local Network

In a separate terminal:
```bash
npm run deploy:local
```

### Deploy to Base Sepolia Testnet

```bash
npm run deploy:base-sepolia
```

## Project Structure

```
Royale-Protocol/
├── contracts/          # Solidity smart contracts
│   └── RoyaleProtocol.sol
├── test/              # Contract tests
│   └── RoyaleProtocol.test.ts
├── scripts/           # Deployment scripts
│   └── deploy.ts
├── packages/
│   ├── sdk/           # TypeScript SDK
│   │   ├── src/
│   │   │   ├── royale-protocol.ts
│   │   │   ├── encryption.ts
│   │   │   ├── ipfs.ts
│   │   │   └── types.ts
│   │   └── package.json
│   └── react-hooks/   # React hooks library
│       ├── src/
│       │   ├── useRoyaleProtocol.ts
│       │   ├── useVault.ts
│       │   └── useVaults.ts
│       └── package.json
├── hardhat.config.ts  # Hardhat configuration
├── tsconfig.json      # TypeScript configuration
└── package.json       # Root package.json
```

## Building Packages

Build all packages:
```bash
npm run build
```

Build individual packages:
```bash
cd packages/sdk && npm run build
cd packages/react-hooks && npm run build
```

## Testing

### Smart Contract Tests

Tests are located in `test/` and use Hardhat's testing framework:

```bash
npm test
```

### SDK Tests

(To be implemented)

## Deployment

### Base Sepolia Testnet

1. Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Set `PRIVATE_KEY` in `.env`
3. Set `BASE_SEPOLIA_RPC_URL` in `.env`
4. Deploy:
```bash
npm run deploy:base-sepolia
```

### Base Mainnet

1. Set `PRIVATE_KEY` in `.env`
2. Set `BASE_RPC_URL` in `.env`
3. Set `BASESCAN_API_KEY` for contract verification
4. Deploy:
```bash
npm run deploy:base
```

## Verification

After deployment, verify the contract:

```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS>
```

## Next Steps

- Read [EXAMPLES.md](./EXAMPLES.md) for usage examples
- Check [README.md](./README.md) for protocol documentation
- Review security considerations in the README

