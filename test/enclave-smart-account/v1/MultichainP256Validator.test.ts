import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { MerkleTree } from "merkletreejs";
import { keccak256, toUtf8Bytes } from "ethers";

describe("MultichainP256Validator", function () {
  let validator: Contract;
  let moduleManager: Contract;
  let owner: any;
  let precompile: string;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();

    // Deploy ModuleManager
    const ModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
    moduleManager = await ModuleManager.deploy(ownerAddress);
    await moduleManager.waitForDeployment();

    // Deploy validator with mock precompile address
    precompile = "0x0000000000000000000000000000000000000001"; // Mock precompile address
    const Validator = await ethers.getContractFactory("MultichainP256Validator");
    validator = await Validator.deploy(moduleManager.target, precompile);
    await validator.waitForDeployment();
  });

  describe("Merkle Proof Verification", function () {
    it("should verify valid merkle proof", async function () {
      // Create test leaves
      const leaves = [
        keccak256(toUtf8Bytes("leaf1")),
        keccak256(toUtf8Bytes("leaf2")),
        keccak256(toUtf8Bytes("leaf3"))
      ];

      // Create merkle tree
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();

      // Get proof for first leaf
      const leaf = leaves[0];
      const proof = tree.getHexProof(leaf);

      // Verify the proof
      const isValid = await validator._verifyMerkleProof(root, proof, leaf);
      expect(isValid).to.be.true;
    });

    it("should reject invalid merkle proof", async function () {
      // Create test leaves
      const leaves = [
        keccak256(toUtf8Bytes("leaf1")),
        keccak256(toUtf8Bytes("leaf2")),
        keccak256(toUtf8Bytes("leaf3"))
      ];

      // Create merkle tree
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();

      // Get proof for first leaf
      const leaf = leaves[0];
      const proof = tree.getHexProof(leaf);

      // Modify the proof to make it invalid
      proof[0] = keccak256(toUtf8Bytes("invalid"));

      // Verify the proof
      const isValid = await validator._verifyMerkleProof(root, proof, leaf);
      expect(isValid).to.be.false;
    });

    it("should verify proof for single leaf", async function () {
      // Create single leaf
      const leaf = keccak256(toUtf8Bytes("single leaf"));
      const leaves = [leaf];

      // Create merkle tree
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();

      // Get proof (should be empty array for single leaf)
      const proof = tree.getHexProof(leaf);

      // Verify the proof
      const isValid = await validator._verifyMerkleProof(root, proof, leaf);
      expect(isValid).to.be.true;
    });

    it("should handle empty proof array", async function () {
      // Create test leaves
      const leaves = [
        keccak256(toUtf8Bytes("leaf1")),
        keccak256(toUtf8Bytes("leaf2"))
      ];

      // Create merkle tree
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();

      // Try to verify with empty proof
      const leaf = leaves[0];
      const emptyProof: string[] = [];

      // Verify the proof
      const isValid = await validator._verifyMerkleProof(root, emptyProof, leaf);
      expect(isValid).to.be.false;
    });

    it("should handle large merkle tree", async function () {
      // Create 100 leaves
      const leaves = Array(100)
        .fill(0)
        .map((_, i) => keccak256(toUtf8Bytes(`leaf${i}`)));

      // Create merkle tree
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();

      // Get proof for middle leaf
      const leaf = leaves[50];
      const proof = tree.getHexProof(leaf);

      // Verify the proof
      const isValid = await validator._verifyMerkleProof(root, proof, leaf);
      expect(isValid).to.be.true;
    });
  });
}); 