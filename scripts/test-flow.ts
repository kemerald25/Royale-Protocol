import { ethers } from "hardhat";
import { RoyaleProtocol } from "../packages/sdk/src/royale-protocol";
import { VaultStatus } from "../packages/sdk/src/types";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Helper function to map status enum to readable string
function getStatusString(status: VaultStatus | number): string {
  const statusNum = typeof status === "number" ? status : Number(status);
  switch (statusNum) {
    case 0:
      return "Active";
    case 1:
      return "Triggered";
    case 2:
      return "Claimed";
    case 3:
      return "Cancelled";
    default:
      return `Unknown (${statusNum})`;
  }
}

// Load environment variables from .env file
dotenv.config();

/**
 * End-to-end test script simulating real-world usage of Royale Protocol
 * This script demonstrates the complete flow:
 * 1. Owner creates a vault with encrypted seed phrase
 * 2. Owner performs check-ins
 * 3. Recovery is triggered after inactivity
 * 4. Beneficiary claims and decrypts the secret
 */

async function main() {
  console.log("🚀 Starting Royale Protocol End-to-End Test Flow\n");
  console.log("=" .repeat(60));

  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("deployment.json not found. Please deploy the contract first.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const contractAddress = deployment.contractAddress;
  const networkName = deployment.network.name;

  console.log(`📋 Contract Address: ${contractAddress}`);
  console.log(`🌐 Network: ${networkName} (Chain ID: ${deployment.network.chainId})\n`);

  // Get signers (simulating owner and beneficiary)
  const [owner, beneficiary, triggerer] = await ethers.getSigners();
  console.log(`👤 Owner: ${owner.address}`);
  console.log(`👤 Beneficiary: ${beneficiary.address}`);
  console.log(`👤 Triggerer: ${triggerer.address}\n`);

  // Step 1: Initialize SDK
  console.log("📦 Step 1: Initializing SDK...");
  const rpcUrl = networkName === "localhost" 
    ? "http://127.0.0.1:8545" 
    : `https://${networkName}.base.org`;
  
  // Use Pinata gateway for IPFS
  const pinataGateway = "https://red-famous-peafowl-148.mypinata.cloud/ipfs/";
  const protocol = new RoyaleProtocol(contractAddress, rpcUrl, pinataGateway);
  
  // Initialize IPFS with Pinata credentials (if available in env)
  // To upload to Pinata dashboard, set PINATA_API_KEY and PINATA_SECRET_KEY in .env
  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretKey = process.env.PINATA_SECRET_KEY;
  
  if (pinataApiKey && pinataSecretKey) {
    await protocol.initializeIPFS(undefined, pinataApiKey, pinataSecretKey);
    console.log(`✅ SDK initialized with Pinata API (uploads will appear in dashboard)`);
    console.log(`   API Key: ${pinataApiKey.substring(0, 8)}...`);
  } else {
    await protocol.initializeIPFS();
    const envPath = path.join(__dirname, "..", ".env");
    console.log(`⚠️  Pinata credentials not found. Using local storage for testing.`);
    if (!fs.existsSync(envPath)) {
      console.log(`   ❌ .env file not found at: ${envPath}`);
      console.log(`   📝 Create .env file in project root with:`);
      console.log(`      PINATA_API_KEY=your_api_key`);
      console.log(`      PINATA_SECRET_KEY=your_secret_key`);
    } else {
      console.log(`   ⚠️  .env file exists but PINATA_API_KEY or PINATA_SECRET_KEY not set`);
      console.log(`   📝 Add to .env:`);
      console.log(`      PINATA_API_KEY=your_api_key`);
      console.log(`      PINATA_SECRET_KEY=your_secret_key`);
    }
  }
  
  console.log(`   IPFS Gateway: ${pinataGateway}\n`);
  await protocol.connectSigner(owner);

  // Step 2: Create a vault with a secret (seed phrase)
  console.log("🔐 Step 2: Creating vault with encrypted secret...");
  const secret = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  console.log(`   Secret (seed phrase): ${secret.substring(0, 50)}...`);
  console.log(`   (This will be encrypted client-side before upload)\n`);

  // The SDK's createVault method handles:
  // - Generating encryption key
  // - Encrypting the secret with AES-256-GCM
  // - Uploading to IPFS
  // - Splitting key with Shamir Secret Sharing (2-of-3)
  // - Creating vault on-chain
  
  const inactivityDays = 180; // 6 months
  const graceDays = 30; // 1 month grace period
  console.log(`   Creating vault with:`);
  console.log(`   - Inactivity period: ${inactivityDays} days`);
  console.log(`   - Grace period: ${graceDays} days`);
  console.log(`   - Beneficiary: ${beneficiary.address}\n`);

  const { vaultId, shares, backupShare } = await protocol.createVault({
    secret: secret,
    beneficiary: beneficiary.address,
    inactivityDays: inactivityDays,
    graceDays: graceDays,
  });

  console.log(`   ✅ Vault created! Vault ID: ${vaultId}`);
  console.log(`   📦 Encryption process completed:`);
  console.log(`      - Secret encrypted with AES-256-GCM`);
  console.log(`      - Encrypted data uploaded to IPFS`);
  console.log(`      - Encryption key split into 3 shares (2-of-3 threshold)`);
  console.log(`      - Timelock share stored on-chain (encrypted for beneficiary)`);
  console.log(`   ⚠️  IMPORTANT: Store backup share securely: ${backupShare.substring(0, 30)}...\n`);

  // Save shares for later use (in real scenario, beneficiary would receive their share securely)
  const sharesFile = {
    vaultId: vaultId.toString(),
    beneficiaryShare: shares.beneficiaryShare,
    backupShare: backupShare,
    note: "In production, beneficiary share would be sent securely to beneficiary",
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "test-shares.json"),
    JSON.stringify(sharesFile, null, 2)
  );
  console.log("   💾 Shares saved to test-shares.json (for testing only)\n");

  // Step 3: Owner checks in
  console.log("✅ Step 3: Owner checking in...");
  let vault = await protocol.getVault(vaultId);
  const initialCheckIn = vault.lastCheckIn;
  console.log(`   Last check-in: ${new Date(Number(initialCheckIn) * 1000).toISOString()}`);

  // Simulate time passing (1 day)
  await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
  await ethers.provider.send("evm_mine", []);

  await protocol.checkIn(vaultId);
  vault = await protocol.getVault(vaultId);
  console.log(`   ✅ Check-in successful! New timestamp: ${new Date(Number(vault.lastCheckIn) * 1000).toISOString()}\n`);

  // Step 4: Check vault status
  console.log("📊 Step 4: Checking vault status...");
  const status = await protocol.getVaultStatus(vaultId);
  console.log(`   Status: ${getStatusString(status.status)}`);
  console.log(`   Time until trigger: ${Number(status.timeUntilTrigger) / (24 * 60 * 60)} days`);
  console.log(`   Can trigger: ${status.canTrigger}`);
  console.log(`   Can claim: ${status.canClaim}\n`);

  // Step 5: Simulate inactivity period passing
  console.log("⏰ Step 5: Simulating inactivity period...");
  const inactivitySeconds = inactivityDays * 24 * 60 * 60;
  console.log(`   Fast-forwarding ${inactivityDays} days (${inactivitySeconds} seconds)...`);
  
  await ethers.provider.send("evm_increaseTime", [inactivitySeconds + 1]);
  await ethers.provider.send("evm_mine", []);

  const statusAfterInactivity = await protocol.getVaultStatus(vaultId);
  console.log(`   ✅ Inactivity period elapsed. Can trigger: ${statusAfterInactivity.canTrigger}\n`);

  // Step 6: Trigger recovery
  console.log("🚨 Step 6: Triggering recovery...");
  // Connect as triggerer (anyone can trigger)
  await protocol.connectSigner(triggerer);
  await protocol.triggerRecovery(vaultId);
  
  vault = await protocol.getVault(vaultId);
  console.log(`   ✅ Recovery triggered! Status: ${getStatusString(vault.status)}`);
  console.log(`   Trigger time: ${new Date(Number(vault.triggerTime) * 1000).toISOString()}\n`);

  // Step 7: Wait for grace period
  console.log("⏳ Step 7: Waiting for grace period...");
  const graceSeconds = graceDays * 24 * 60 * 60;
  console.log(`   Fast-forwarding ${graceDays} days (${graceSeconds} seconds)...`);
  
  await ethers.provider.send("evm_increaseTime", [graceSeconds + 1]);
  await ethers.provider.send("evm_mine", []);

  const statusAfterGrace = await protocol.getVaultStatus(vaultId);
  console.log(`   ✅ Grace period elapsed. Can claim: ${statusAfterGrace.canClaim}\n`);

  // Step 8: Beneficiary claims inheritance
  console.log("🎁 Step 8: Beneficiary claiming inheritance...");
  await protocol.connectSigner(beneficiary);
  
  // Load beneficiary share (in production, beneficiary would have received this when vault was created)
  const savedShares = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test-shares.json"), "utf-8"));
  const beneficiaryShare = savedShares.beneficiaryShare;

  console.log(`   Beneficiary has their share: ${beneficiaryShare.substring(0, 20)}...`);
  console.log(`   Claiming timelock share from contract...`);
  
  // The SDK's claimInheritance method:
  // - Claims timelock share from contract
  // - Combines with beneficiary share to reconstruct encryption key
  // - Retrieves encrypted data from IPFS
  // - Decrypts the secret
  const recoveredSecret = await protocol.claimInheritance(vaultId, beneficiaryShare);
  
  console.log(`   ✅ Inheritance claimed and decrypted!`);
  console.log(`   Recovered secret: ${recoveredSecret.substring(0, 50)}...`);
  
  // Verify the secret matches
  if (recoveredSecret === secret) {
    console.log(`   ✅ SUCCESS: Recovered secret matches original!\n`);
  } else {
    console.log(`   ❌ ERROR: Recovered secret does not match!`);
    console.log(`   Expected: ${secret}`);
    console.log(`   Got: ${recoveredSecret}\n`);
    process.exit(1);
  }

  // Step 9: Verify vault status
  console.log("📊 Step 9: Final vault status...");
  vault = await protocol.getVault(vaultId);
  console.log(`   Status: ${getStatusString(vault.status)}`);
  console.log(`   Owner: ${vault.owner}`);
  console.log(`   Beneficiary: ${vault.beneficiary}`);
  console.log(`   IPFS CID: ${vault.ipfsCID}\n`);

  // Summary
  console.log("=" .repeat(60));
  console.log("🎉 END-TO-END TEST COMPLETE!");
  console.log("=" .repeat(60));
  console.log("\n✅ All steps completed successfully:");
  console.log("   1. Vault created with encrypted secret");
  console.log("   2. Owner checked in");
  console.log("   3. Recovery triggered after inactivity");
  console.log("   4. Beneficiary claimed and decrypted secret");
  console.log("\n💡 Key Takeaways:");
  console.log("   - Secret was encrypted client-side (never sent unencrypted)");
  console.log("   - Encryption key was split using Shamir Secret Sharing (2-of-3)");
  console.log("   - Encrypted data stored on IPFS (decentralized)");
  console.log("   - Timelock enforced on-chain (trustless)");
  console.log("   - Beneficiary successfully recovered the secret\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

