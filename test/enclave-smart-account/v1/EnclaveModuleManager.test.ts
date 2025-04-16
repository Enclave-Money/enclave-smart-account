import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { EnclaveModuleManager } from "../../../typechain-types";

describe("EnclaveModuleManager", function () {
  let moduleManager: EnclaveModuleManager;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let admin2: SignerWithAddress;
  let nonAdmin: SignerWithAddress;
  let module: SignerWithAddress;
  let module2: SignerWithAddress;
  let module3: SignerWithAddress;
  let zeroAddress: string = ethers.ZeroAddress;

  beforeEach(async function () {
    [owner, admin, admin2, nonAdmin, module, module2, module3] = await ethers.getSigners();
    
    const ModuleManagerFactory = await ethers.getContractFactory("EnclaveModuleManager");
    moduleManager = await ModuleManagerFactory.deploy(owner.address);
  });

  describe("Constructor", function () {
    it("should set the deployer as admin", async function () {
      expect(await moduleManager.isAdmin(owner.address)).to.be.true;
      expect(await moduleManager.adminCount()).to.equal(1);
    });

    it("should initialize with zero modules enabled", async function () {
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
      expect(await moduleManager.isModuleEnabled(module2.address)).to.be.false;
      expect(await moduleManager.isModuleEnabled(module3.address)).to.be.false;
    });
  });

  describe("Admin Management", function () {
    it("should allow adding a new admin", async function () {
      await moduleManager.connect(owner).addAdmin(admin.address);
      expect(await moduleManager.isAdmin(admin.address)).to.be.true;
      expect(await moduleManager.adminCount()).to.equal(2);
    });

    it("should emit AdminAdded event when admin is added", async function () {
      await expect(moduleManager.connect(owner).addAdmin(admin.address))
        .to.emit(moduleManager, "AdminAdded")
        .withArgs(admin.address);
    });

    it("should revert when non-admin tries to add an admin", async function () {
      await expect(moduleManager.connect(nonAdmin).addAdmin(admin.address))
        .to.be.revertedWithCustomError(moduleManager, "UnauthorizedCaller");
    });

    it("should revert when adding zero address as admin", async function () {
      await expect(moduleManager.connect(owner).addAdmin(zeroAddress))
        .to.be.revertedWithCustomError(moduleManager, "ZeroAddress");
    });

    it("should revert when adding existing admin", async function () {
      await moduleManager.connect(owner).addAdmin(admin.address);
      await expect(moduleManager.connect(owner).addAdmin(admin.address))
        .to.be.revertedWithCustomError(moduleManager, "AlreadyAdmin");
    });

    it("should allow removing an admin", async function () {
      await moduleManager.connect(owner).addAdmin(admin.address);
      expect(await moduleManager.isAdmin(admin.address)).to.be.true;
      expect(await moduleManager.adminCount()).to.equal(2);
      
      await moduleManager.connect(owner).removeAdmin(admin.address);
      expect(await moduleManager.isAdmin(admin.address)).to.be.false;
      expect(await moduleManager.adminCount()).to.equal(1);
    });

    it("should emit AdminRemoved event when admin is removed", async function () {
      await moduleManager.connect(owner).addAdmin(admin.address);
      
      await expect(moduleManager.connect(owner).removeAdmin(admin.address))
        .to.emit(moduleManager, "AdminRemoved")
        .withArgs(admin.address);
    });

    it("should revert when non-admin tries to remove an admin", async function () {
      await moduleManager.connect(owner).addAdmin(admin.address);
      
      await expect(moduleManager.connect(nonAdmin).removeAdmin(admin.address))
        .to.be.revertedWithCustomError(moduleManager, "UnauthorizedCaller");
    });

    it("should revert when removing a non-admin", async function () {
      await expect(moduleManager.connect(owner).removeAdmin(nonAdmin.address))
        .to.be.revertedWithCustomError(moduleManager, "NotAdmin");
    });

    it("should allow an admin to remove themselves if not the last admin", async function () {
      await moduleManager.connect(owner).addAdmin(admin.address);
      expect(await moduleManager.isAdmin(admin.address)).to.be.true;
      
      await moduleManager.connect(admin).removeAdmin(admin.address);
      expect(await moduleManager.isAdmin(admin.address)).to.be.false;
    });

    it("should prevent removing the last admin", async function () {
      // Try to remove the only admin
      await expect(moduleManager.connect(owner).removeAdmin(owner.address))
        .to.be.revertedWithCustomError(moduleManager, "CannotRemoveLastAdmin");
      
      // Add another admin and remove the first one
      await moduleManager.connect(owner).addAdmin(admin.address);
      await moduleManager.connect(owner).removeAdmin(owner.address);
      
      // Try to remove the now only admin
      await expect(moduleManager.connect(admin).removeAdmin(admin.address))
        .to.be.revertedWithCustomError(moduleManager, "CannotRemoveLastAdmin");
    });

    it("should accurately track admin count through multiple operations", async function () {
      // Initial state: 1 admin (owner)
      expect(await moduleManager.adminCount()).to.equal(1);
      
      // Add admin1
      await moduleManager.connect(owner).addAdmin(admin.address);
      expect(await moduleManager.adminCount()).to.equal(2);
      
      // Add admin2
      await moduleManager.connect(owner).addAdmin(admin2.address);
      expect(await moduleManager.adminCount()).to.equal(3);
      
      // Remove admin1
      await moduleManager.connect(owner).removeAdmin(admin.address);
      expect(await moduleManager.adminCount()).to.equal(2);
      
      // Add back admin1
      await moduleManager.connect(owner).addAdmin(admin.address);
      expect(await moduleManager.adminCount()).to.equal(3);
      
      // Remove owner and admin2
      await moduleManager.connect(owner).removeAdmin(owner.address);
      await moduleManager.connect(admin).removeAdmin(admin2.address);
      expect(await moduleManager.adminCount()).to.equal(1);
      
      // Only admin1 should remain as admin
      expect(await moduleManager.isAdmin(owner.address)).to.be.false;
      expect(await moduleManager.isAdmin(admin.address)).to.be.true;
      expect(await moduleManager.isAdmin(admin2.address)).to.be.false;
    });
  });

  describe("Module Management", function () {
    it("should allow admin to enable a module", async function () {
      await moduleManager.connect(owner).enableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
    });

    it("should emit ModuleEnabled event when module is enabled", async function () {
      await expect(moduleManager.connect(owner).enableModule(module.address))
        .to.emit(moduleManager, "ModuleEnabled")
        .withArgs(module.address);
    });

    it("should revert when non-admin tries to enable a module", async function () {
      await expect(moduleManager.connect(nonAdmin).enableModule(module.address))
        .to.be.revertedWithCustomError(moduleManager, "UnauthorizedCaller");
    });

    it("should revert when enabling zero address as module", async function () {
      await expect(moduleManager.connect(owner).enableModule(zeroAddress))
        .to.be.revertedWithCustomError(moduleManager, "InvalidModuleAddress");
    });

    it("should allow enabling an already enabled module", async function () {
      await moduleManager.connect(owner).enableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      
      // Enable again
      await moduleManager.connect(owner).enableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
    });

    it("should allow admin to disable a module", async function () {
      await moduleManager.connect(owner).enableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      
      await moduleManager.connect(owner).disableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
    });

    it("should emit ModuleDisabled event when module is disabled", async function () {
      await moduleManager.connect(owner).enableModule(module.address);
      
      await expect(moduleManager.connect(owner).disableModule(module.address))
        .to.emit(moduleManager, "ModuleDisabled")
        .withArgs(module.address);
    });

    it("should revert when non-admin tries to disable a module", async function () {
      await moduleManager.connect(owner).enableModule(module.address);
      
      await expect(moduleManager.connect(nonAdmin).disableModule(module.address))
        .to.be.revertedWithCustomError(moduleManager, "UnauthorizedCaller");
    });

    it("should revert when disabling zero address as module", async function () {
      await expect(moduleManager.connect(owner).disableModule(zeroAddress))
        .to.be.revertedWithCustomError(moduleManager, "InvalidModuleAddress");
    });

    it("should allow disabling an already disabled module", async function () {
      // Module is disabled by default
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
      
      // Disable again
      await moduleManager.connect(owner).disableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
    });

    it("should correctly report module state", async function () {
      // Initially not enabled
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
      
      // After enabling
      await moduleManager.connect(owner).enableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      
      // After disabling
      await moduleManager.connect(owner).disableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
      
      // Re-enable
      await moduleManager.connect(owner).enableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
    });

    it("should allow multiple admins to manage modules", async function () {
      await moduleManager.connect(owner).addAdmin(admin.address);
      
      // First admin enables a module
      await moduleManager.connect(owner).enableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      
      // Second admin disables the module
      await moduleManager.connect(admin).disableModule(module.address);
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
    });

    it("should handle multiple module operations correctly", async function () {
      // Enable multiple modules
      await moduleManager.connect(owner).enableModule(module.address);
      await moduleManager.connect(owner).enableModule(module2.address);
      await moduleManager.connect(owner).enableModule(module3.address);
      
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      expect(await moduleManager.isModuleEnabled(module2.address)).to.be.true;
      expect(await moduleManager.isModuleEnabled(module3.address)).to.be.true;
      
      // Disable some modules
      await moduleManager.connect(owner).disableModule(module.address);
      await moduleManager.connect(owner).disableModule(module3.address);
      
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.false;
      expect(await moduleManager.isModuleEnabled(module2.address)).to.be.true;
      expect(await moduleManager.isModuleEnabled(module3.address)).to.be.false;
      
      // Re-enable one
      await moduleManager.connect(owner).enableModule(module.address);
      
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      expect(await moduleManager.isModuleEnabled(module2.address)).to.be.true;
      expect(await moduleManager.isModuleEnabled(module3.address)).to.be.false;
    });
  });

  describe("Gas Efficiency and Edge Cases", function () {
    it("should have predictable gas costs for module operations", async function () {
      // First enable - should cost more
      const tx1 = await moduleManager.connect(owner).enableModule(module.address);
      const receipt1 = await tx1.wait();
      const gasUsed1 = receipt1!.gasUsed;
      
      // Second enable on the same module - should cost similar
      // Note: This is a different operation because the module state changes 
      // from disabled to enabled in the first call, and the second call 
      // is for an already enabled module (no change in state)
      const tx2 = await moduleManager.connect(owner).enableModule(module.address);
      const receipt2 = await tx2.wait();
      
      // Disable operation
      const tx3 = await moduleManager.connect(owner).disableModule(module.address);
      const receipt3 = await tx3.wait();
      
      // Enable a different module - should be similar to the first enable
      const tx4 = await moduleManager.connect(owner).enableModule(module2.address);
      const receipt4 = await tx4.wait();
      const gasUsed4 = receipt4!.gasUsed;
      
      // Gas usage should be similar for same type of operation (enable)
      // with similar state change (disabled -> enabled)
      expect(Number(gasUsed1)).to.be.within(
        Number(gasUsed4) * 0.9, 
        Number(gasUsed4) * 1.1
      );
    });

    it("should handle admin changes correctly even after many operations", async function () {
      // Add multiple admins
      const randomAdmins = [];
      for (let i = 0; i < 3; i++) {
        const address = await ethers.Wallet.createRandom().getAddress();
        randomAdmins.push(address);
        await moduleManager.connect(owner).addAdmin(address);
      }
      
      // Should be 4 admins (original + 3 new)
      expect(await moduleManager.adminCount()).to.equal(4);
      
      // Add 2 more admins
      await moduleManager.connect(owner).addAdmin(admin.address);
      await moduleManager.connect(owner).addAdmin(admin2.address);
      
      // Should be 6 admins
      expect(await moduleManager.adminCount()).to.equal(6);
      
      // Remove 2 of the admins
      await moduleManager.connect(owner).removeAdmin(admin.address);
      await moduleManager.connect(owner).removeAdmin(admin2.address);
      
      // Should be 4 admins
      expect(await moduleManager.adminCount()).to.equal(4);
      
      // Add 10 more admins
      const moreAdmins = [];
      for (let i = 0; i < 10; i++) {
        const address = await ethers.Wallet.createRandom().getAddress();
        moreAdmins.push(address);
        await moduleManager.connect(owner).addAdmin(address);
      }
      
      // Should be 14 admins (4 + 10)
      expect(await moduleManager.adminCount()).to.equal(14);
      
      // Remove 5 admins
      for (let i = 0; i < 5; i++) {
        await moduleManager.connect(owner).removeAdmin(moreAdmins[i]);
      }
      
      // Should be 9 admins (14 - 5)
      expect(await moduleManager.adminCount()).to.equal(9);
    });

    it("should correctly handle module state changes after many operations", async function() {
      // Create several random module addresses
      const moduleAddresses = [];
      for (let i = 0; i < 10; i++) {
        moduleAddresses.push(ethers.Wallet.createRandom().address);
      }
      
      // Enable all modules
      for (const addr of moduleAddresses) {
        await moduleManager.connect(owner).enableModule(addr);
        expect(await moduleManager.isModuleEnabled(addr)).to.be.true;
      }
      
      // Disable some modules
      for (let i = 0; i < 5; i++) {
        await moduleManager.connect(owner).disableModule(moduleAddresses[i]);
      }
      
      // Verify the correct modules are disabled
      for (let i = 0; i < moduleAddresses.length; i++) {
        if (i < 5) {
          expect(await moduleManager.isModuleEnabled(moduleAddresses[i])).to.be.false;
        } else {
          expect(await moduleManager.isModuleEnabled(moduleAddresses[i])).to.be.true;
        }
      }
      
      // Re-enable the first three
      for (let i = 0; i < 3; i++) {
        await moduleManager.connect(owner).enableModule(moduleAddresses[i]);
      }
      
      // Verify the correct modules are enabled/disabled
      for (let i = 0; i < moduleAddresses.length; i++) {
        if (i >= 3 && i < 5) {
          expect(await moduleManager.isModuleEnabled(moduleAddresses[i])).to.be.false;
        } else {
          expect(await moduleManager.isModuleEnabled(moduleAddresses[i])).to.be.true;
        }
      }
    });
  });

  describe("State consistency", function() {
    it("should maintain separate state for admins and modules", async function() {
      // Address can be both an admin and a module
      await moduleManager.connect(owner).addAdmin(module.address);
      await moduleManager.connect(owner).enableModule(module.address);
      
      // Should be both an admin and an enabled module
      expect(await moduleManager.isAdmin(module.address)).to.be.true;
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      
      // Removing as admin shouldn't affect module status
      await moduleManager.connect(owner).removeAdmin(module.address);
      
      expect(await moduleManager.isAdmin(module.address)).to.be.false;
      expect(await moduleManager.isModuleEnabled(module.address)).to.be.true;
      
      // Similarly, disabling as module shouldn't affect admin status
      await moduleManager.connect(owner).addAdmin(module2.address);
      await moduleManager.connect(owner).enableModule(module2.address);
      
      await moduleManager.connect(owner).disableModule(module2.address);
      
      expect(await moduleManager.isAdmin(module2.address)).to.be.true;
      expect(await moduleManager.isModuleEnabled(module2.address)).to.be.false;
    });
  });
}); 