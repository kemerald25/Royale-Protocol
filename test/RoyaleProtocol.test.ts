import { expect } from "chai";
import { ethers } from "hardhat";
import { RoyaleProtocol, RoyaleProtocol__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RoyaleProtocol", function () {
  let royaleProtocol: RoyaleProtocol;
  let owner: HardhatEthersSigner;
  let beneficiary: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  const IPFS_CID = "QmTest123456789";
  const ENCRYPTED_KEY = "encrypted_key_123";

  beforeEach(async function () {
    [owner, beneficiary, other] = await ethers.getSigners();

    const RoyaleProtocolFactory = new RoyaleProtocol__factory(owner);
    royaleProtocol = await RoyaleProtocolFactory.deploy();
    await royaleProtocol.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await royaleProtocol.getAddress()).to.be.properAddress;
    });

    it("Should start with zero vaults", async function () {
      expect(await royaleProtocol.totalVaults()).to.equal(0);
    });
  });

  describe("createVault", function () {
    it("Should create a vault successfully", async function () {
      const inactivityDays = 180;
      const graceDays = 30;

      await expect(
        royaleProtocol
          .connect(owner)
          .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, inactivityDays, graceDays)
      )
        .to.emit(royaleProtocol, "VaultCreated")
        .withArgs(0, owner.address, beneficiary.address, inactivityDays, graceDays);

      const vault = await royaleProtocol.getVault(0);
      expect(vault.owner).to.equal(owner.address);
      expect(vault.beneficiary).to.equal(beneficiary.address);
      expect(vault.ipfsCID).to.equal(IPFS_CID);
      expect(vault.encryptedTimelockKey).to.equal(ENCRYPTED_KEY);
      expect(vault.inactivityPeriod).to.equal(inactivityDays * 24 * 60 * 60);
      expect(vault.gracePeriod).to.equal(graceDays * 24 * 60 * 60);
      expect(vault.status).to.equal(0); // Active
    });

    it("Should reject zero address beneficiary", async function () {
      await expect(
        royaleProtocol
          .connect(owner)
          .createVault(ethers.ZeroAddress, IPFS_CID, ENCRYPTED_KEY, 180, 30)
      ).to.be.revertedWith("Invalid beneficiary");
    });

    it("Should reject self as beneficiary", async function () {
      await expect(
        royaleProtocol
          .connect(owner)
          .createVault(owner.address, IPFS_CID, ENCRYPTED_KEY, 180, 30)
      ).to.be.revertedWith("Cannot be your own beneficiary");
    });

    it("Should reject empty IPFS CID", async function () {
      await expect(
        royaleProtocol
          .connect(owner)
          .createVault(beneficiary.address, "", ENCRYPTED_KEY, 180, 30)
      ).to.be.revertedWith("IPFS CID required");
    });

    it("Should reject empty encrypted key", async function () {
      await expect(
        royaleProtocol
          .connect(owner)
          .createVault(beneficiary.address, IPFS_CID, "", 180, 30)
      ).to.be.revertedWith("Encrypted key required");
    });

    it("Should reject zero inactivity period", async function () {
      await expect(
        royaleProtocol
          .connect(owner)
          .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 0, 30)
      ).to.be.revertedWith("Inactivity period must be > 0");
    });

    it("Should reject zero grace period", async function () {
      await expect(
        royaleProtocol
          .connect(owner)
          .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 0)
      ).to.be.revertedWith("Grace period must be > 0");
    });

    it("Should track vaults for owner and beneficiary", async function () {
      await royaleProtocol
        .connect(owner)
        .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 30);

      const ownerVaults = await royaleProtocol.getOwnerVaults(owner.address);
      const beneficiaryVaults = await royaleProtocol.getBeneficiaryVaults(beneficiary.address);

      expect(ownerVaults.length).to.equal(1);
      expect(ownerVaults[0]).to.equal(0);
      expect(beneficiaryVaults.length).to.equal(1);
      expect(beneficiaryVaults[0]).to.equal(0);
    });
  });

  describe("checkIn", function () {
    beforeEach(async function () {
      await royaleProtocol
        .connect(owner)
        .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 30);
    });

    it("Should update last check-in timestamp", async function () {
      const vaultBefore = await royaleProtocol.getVault(0);
      const initialCheckIn = vaultBefore.lastCheckIn;

      // Wait a bit
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []); // Mine block to update timestamp

      const tx = await royaleProtocol.connect(owner).checkIn(0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(royaleProtocol, "CheckIn")
        .withArgs(0, owner.address, block!.timestamp);

      const vaultAfter = await royaleProtocol.getVault(0);
      expect(vaultAfter.lastCheckIn).to.be.gt(initialCheckIn);
    });

    it("Should reset triggered vault to active", async function () {
      // Fast forward to trigger
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(other).triggerRecovery(0);

      let vault = await royaleProtocol.getVault(0);
      expect(vault.status).to.equal(1); // Triggered

      // Check in should reset to active
      await royaleProtocol.connect(owner).checkIn(0);
      vault = await royaleProtocol.getVault(0);
      expect(vault.status).to.equal(0); // Active
      expect(vault.triggerTime).to.equal(0);
    });

    it("Should reject check-in from non-owner", async function () {
      await expect(royaleProtocol.connect(beneficiary).checkIn(0)).to.be.revertedWith(
        "Not vault owner"
      );
    });

    it("Should reject check-in for non-active vault", async function () {
      await royaleProtocol.connect(owner).cancelVault(0);
      await expect(royaleProtocol.connect(owner).checkIn(0)).to.be.revertedWith(
        "Vault not active"
      );
    });
  });

  describe("triggerRecovery", function () {
    beforeEach(async function () {
      await royaleProtocol
        .connect(owner)
        .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 30);
    });

    it("Should trigger recovery after inactivity period", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []); // Mine a block to update timestamp

      const tx = await royaleProtocol.connect(other).triggerRecovery(0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(royaleProtocol, "VaultTriggered")
        .withArgs(0, other.address, block!.timestamp);

      const vault = await royaleProtocol.getVault(0);
      expect(vault.status).to.equal(1); // Triggered
      expect(vault.triggerTime).to.be.gt(0);
    });

    it("Should reject trigger before inactivity period", async function () {
      await expect(royaleProtocol.connect(other).triggerRecovery(0)).to.be.revertedWith(
        "Inactivity period not met"
      );
    });

    it("Should reject trigger for non-active vault", async function () {
      await royaleProtocol.connect(owner).cancelVault(0);
      await expect(royaleProtocol.connect(other).triggerRecovery(0)).to.be.revertedWith(
        "Vault not active"
      );
    });
  });

  describe("claimInheritance", function () {
    beforeEach(async function () {
      await royaleProtocol
        .connect(owner)
        .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 30);
    });

    it("Should allow beneficiary to claim after grace period", async function () {
      // Trigger recovery
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(other).triggerRecovery(0);

      // Wait for grace period
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);

      await expect(royaleProtocol.connect(beneficiary).claimInheritance(0))
        .to.emit(royaleProtocol, "VaultClaimed")
        .withArgs(0, beneficiary.address, IPFS_CID, ENCRYPTED_KEY);

      const vault = await royaleProtocol.getVault(0);
      expect(vault.status).to.equal(2); // Claimed
    });

    it("Should return IPFS CID and encrypted key", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await royaleProtocol.connect(other).triggerRecovery(0);
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []); // Mine block to ensure grace period is elapsed

      const [ipfsCID, encryptedKey] = await royaleProtocol
        .connect(beneficiary)
        .claimInheritance.staticCall(0);

      expect(ipfsCID).to.equal(IPFS_CID);
      expect(encryptedKey).to.equal(ENCRYPTED_KEY);
    });

    it("Should reject claim before grace period", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(other).triggerRecovery(0);

      await expect(royaleProtocol.connect(beneficiary).claimInheritance(0)).to.be.revertedWith(
        "Grace period not elapsed"
      );
    });

    it("Should reject claim from non-beneficiary", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(other).triggerRecovery(0);
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);

      await expect(royaleProtocol.connect(other).claimInheritance(0)).to.be.revertedWith(
        "Not vault beneficiary"
      );
    });

    it("Should reject claim for non-triggered vault", async function () {
      await expect(royaleProtocol.connect(beneficiary).claimInheritance(0)).to.be.revertedWith(
        "Vault not triggered"
      );
    });
  });

  describe("cancelVault", function () {
    beforeEach(async function () {
      await royaleProtocol
        .connect(owner)
        .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 30);
    });

    it("Should cancel active vault", async function () {
      await expect(royaleProtocol.connect(owner).cancelVault(0))
        .to.emit(royaleProtocol, "VaultCancelled")
        .withArgs(0, owner.address);

      const vault = await royaleProtocol.getVault(0);
      expect(vault.status).to.equal(3); // Cancelled
    });

    it("Should cancel triggered vault", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(other).triggerRecovery(0);

      await royaleProtocol.connect(owner).cancelVault(0);
      const vault = await royaleProtocol.getVault(0);
      expect(vault.status).to.equal(3); // Cancelled
    });

    it("Should reject cancel from non-owner", async function () {
      await expect(royaleProtocol.connect(beneficiary).cancelVault(0)).to.be.revertedWith(
        "Not vault owner"
      );
    });

    it("Should reject cancel for claimed vault", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(other).triggerRecovery(0);
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(beneficiary).claimInheritance(0);

      await expect(royaleProtocol.connect(owner).cancelVault(0)).to.be.revertedWith(
        "Cannot cancel vault"
      );
    });
  });

  describe("getVaultStatus", function () {
    beforeEach(async function () {
      await royaleProtocol
        .connect(owner)
        .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 30);
    });

    it("Should return correct status for active vault", async function () {
      const [status, timeUntilTrigger, canClaim, canTrigger] =
        await royaleProtocol.getVaultStatus(0);

      expect(status).to.equal(0); // Active
      expect(timeUntilTrigger).to.be.gt(0);
      expect(canClaim).to.be.false;
      expect(canTrigger).to.be.false;
    });

    it("Should return correct status for triggered vault", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await royaleProtocol.connect(other).triggerRecovery(0);

      const [status, timeUntilTrigger, canClaim, canTrigger] =
        await royaleProtocol.getVaultStatus(0);

      expect(status).to.equal(1); // Triggered
      expect(timeUntilTrigger).to.equal(0);
      expect(canClaim).to.be.false; // Grace period not elapsed
      expect(canTrigger).to.be.false;
    });

    it("Should return canClaim true after grace period", async function () {
      await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await royaleProtocol.connect(other).triggerRecovery(0);
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []); // Mine block to ensure grace period is elapsed

      const [, , canClaim] = await royaleProtocol.getVaultStatus(0);
      expect(canClaim).to.be.true;
    });
  });

  describe("Multiple Vaults", function () {
    it("Should handle multiple vaults correctly", async function () {
      await royaleProtocol
        .connect(owner)
        .createVault(beneficiary.address, IPFS_CID, ENCRYPTED_KEY, 180, 30);

      await royaleProtocol
        .connect(owner)
        .createVault(other.address, IPFS_CID + "2", ENCRYPTED_KEY + "2", 90, 15);

      expect(await royaleProtocol.totalVaults()).to.equal(2);

      const ownerVaults = await royaleProtocol.getOwnerVaults(owner.address);
      expect(ownerVaults.length).to.equal(2);
      expect(ownerVaults[0]).to.equal(0);
      expect(ownerVaults[1]).to.equal(1);

      const beneficiaryVaults = await royaleProtocol.getBeneficiaryVaults(beneficiary.address);
      expect(beneficiaryVaults.length).to.equal(1);
      expect(beneficiaryVaults[0]).to.equal(0);
    });
  });
});

