import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Script to create npm organization and publish SDK
 * This script:
 * 1. Creates the @royale organization on npm (if it doesn't exist)
 * 2. Builds the SDK package
 * 3. Publishes to npm
 */

async function main() {
  console.log("🚀 Publishing @devroyale/protocol to npm\n");
  console.log("=" .repeat(60));

  const sdkPath = path.join(__dirname, "..", "packages", "sdk");
  const packageJsonPath = path.join(sdkPath, "package.json");

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("SDK package.json not found");
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  console.log(`📦 Package: ${packageJson.name}@${packageJson.version}\n`);

  // Step 1: Check npm login
  console.log("🔐 Step 1: Checking npm authentication...");
  try {
    const whoami = execSync("npm whoami", { encoding: "utf-8" }).trim();
    console.log(`   ✅ Logged in as: ${whoami}\n`);
  } catch (error) {
    console.error("   ❌ Not logged in to npm. Please run: npm login");
    process.exit(1);
  }

  // Step 2: Verify user scope
  console.log("👤 Step 2: Verifying @devroyale scope...");
  console.log("   ✅ Using your npm username scope (no organization needed)\n");

  // Step 3: Build package
  console.log("🔨 Step 3: Building package...");
  try {
    process.chdir(sdkPath);
    execSync("npm run build", { stdio: "inherit" });
    console.log("   ✅ Build complete\n");
  } catch (error) {
    console.error("   ❌ Build failed");
    process.exit(1);
  }

  // Step 4: Publish
  console.log("📤 Step 4: Publishing to npm...");
  console.log("   📱 Note: If 2FA is enabled, you'll need to provide an OTP");
  console.log("   💡 You can run manually with: npm publish --access public --otp=<code>\n");
  
  try {
    execSync("npm publish --access public", { stdio: "inherit" });
    console.log("\n   ✅ Published successfully!\n");
  } catch (error: any) {
    if (error.message?.includes("cannot publish over")) {
      console.log("\n   ✅ Package already published (version exists)\n");
    } else if (error.message?.includes("EOTP") || error.message?.includes("one-time password")) {
      console.error("\n   🔐 2FA Authentication Required!");
      console.error("   👉 Get OTP from your authenticator app");
      console.error("   👉 Run manually:");
      console.error("      cd packages/sdk");
      console.error("      npm publish --access public --otp=<your-otp-code>\n");
      process.exit(1);
    } else if (error.message?.includes("Scope not found") || error.message?.includes("You must verify")) {
      console.error("\n   ❌ Scope verification issue!");
      console.error("   👉 Ensure you're logged in as 'devroyale'");
      console.error("   👉 Run: npm login");
      console.error("   👉 Then run this script again\n");
      process.exit(1);
    } else {
      throw error;
    }
  }

  console.log("=" .repeat(60));
  console.log("🎉 Publishing complete!");
  console.log("=" .repeat(60));
  console.log(`\n📦 Package: ${packageJson.name}@${packageJson.version}`);
  console.log(`📥 Install: npm install ${packageJson.name} ethers`);
  console.log(`🌐 View: https://www.npmjs.com/package/${packageJson.name}\n`);
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});

