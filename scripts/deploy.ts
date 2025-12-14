import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying RoyaleProtocol...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || "unknown";
  const chainId = Number(network.chainId);

  const RoyaleProtocol = await ethers.getContractFactory("RoyaleProtocol");
  const royaleProtocol = await RoyaleProtocol.deploy();

  const deploymentTx = royaleProtocol.deploymentTransaction();
  if (!deploymentTx) {
    throw new Error("Deployment transaction not found");
  }

  await royaleProtocol.waitForDeployment();

  const address = await royaleProtocol.getAddress();
  console.log("RoyaleProtocol deployed to:", address);

  // Get deployment transaction receipt
  const receipt = await ethers.provider.getTransactionReceipt(deploymentTx.hash);
  const block = await ethers.provider.getBlock(receipt!.blockNumber);

  // Verify deployment
  const totalVaults = await royaleProtocol.totalVaults();
  console.log("Initial vault count:", totalVaults.toString());

  // Create deployment info object
  const deploymentInfo = {
    contractName: "RoyaleProtocol",
    contractAddress: address,
    network: {
      name: networkName,
      chainId: chainId,
    },
    deployer: {
      address: deployer.address,
      balance: (await ethers.provider.getBalance(deployer.address)).toString(),
    },
    transaction: {
      hash: deploymentTx.hash,
      blockNumber: receipt!.blockNumber,
      blockHash: receipt!.blockHash,
      gasUsed: receipt!.gasUsed.toString(),
      gasPrice: deploymentTx.gasPrice?.toString() || "0",
    },
    deployment: {
      timestamp: block!.timestamp,
      date: new Date(Number(block!.timestamp) * 1000).toISOString(),
    },
    verification: {
      command: `npx hardhat verify --network ${networkName} ${address}`,
    },
  };

  // Save deployment info to JSON file
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\nDeployment complete!");
  console.log("Contract address:", address);
  console.log("Deployment info saved to:", deploymentPath);
  console.log("\nTo verify on Basescan, run:");
  console.log(deploymentInfo.verification.command);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

