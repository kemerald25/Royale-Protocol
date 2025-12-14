# Publishing @devroyale/protocol to npm

Publishing scoped packages under your npm username (`devroyale`) - no organization needed!

## Quick Setup

1. **Verify Login:**
   ```bash
   npm whoami
   ```
   Should show: `devroyale`

2. **Publish SDK:**
   ```bash
   npm run publish:sdk
   ```

   Or manually:
   ```bash
   cd packages/sdk
   npm run build
   npm publish --access public
   ```

## Package Names

- **SDK:** `@devroyale/protocol`
- **React Hooks:** `@devroyale/react-hooks`

## Installation

After publishing, users can install:

```bash
npm install @devroyale/protocol ethers
npm install @devroyale/react-hooks @devroyale/protocol react ethers
```

## Requirements

- npm account logged in as `devroyale`
- 2FA enabled (recommended for security)

## Troubleshooting

**Error: "403 Forbidden"**
- Enable 2FA on your npm account: https://www.npmjs.com/settings/devroyale/security
- Ensure you're logged in: `npm login`

**Error: "Cannot publish over existing version"**
- Package is already published (success!)
- Bump version in package.json to publish new version

**Error: "You must verify your email"**
- Verify your email at: https://www.npmjs.com/settings/devroyale/profile

