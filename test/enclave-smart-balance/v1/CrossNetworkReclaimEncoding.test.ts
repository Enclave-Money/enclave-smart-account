import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("CrossNetworkReclaimEncoding", function () {
  let encoding: any;
  let deployer: Signer;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();
    const CrossNetworkReclaimEncoding = await ethers.getContractFactory("CrossNetworkReclaimEncoding");
    encoding = await CrossNetworkReclaimEncoding.deploy();
    await encoding.waitForDeployment();
    // Add this line to ensure we're working with the deployed contract
    // encoding = CrossNetworkReclaimEncoding
  });

  describe("encode and decode", function () {
    it("should handle single repayment", async function () {
      const chainIds: number[] = [1];
      const amounts: number[] = [1000];

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(1);
      expect(decoded[0].chainId).to.equal(chainIds[0]);
      expect(decoded[0].amount).to.equal(amounts[0]);
    });

    it("should handle multiple repayments with common chain IDs", async function () {
      const chainIds: number[] = [1, 137, 42161]; // Ethereum, Polygon, Arbitrum
      const amounts: BigInt[] = [
        ethers.parseEther("1.5"),
        ethers.parseEther("2.0"),
        ethers.parseEther("3.0")
      ];

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(3);
      for (let i = 0; i < 3; i++) {
        expect(decoded[i].chainId).to.equal(chainIds[i]);
        expect(decoded[i].amount).to.equal(amounts[i]);
      }
    });

    it("should handle maximum uint256 values", async function () {
      const maxUint256 = ethers.MaxUint256;
      const chainIds: BigInt[] = [maxUint256, maxUint256 - 1n];
      const amounts: BigInt[] = [maxUint256, maxUint256 - 1n];

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(2);
      for (let i = 0; i < 2; i++) {
        expect(decoded[i].chainId).to.equal(chainIds[i]);
        expect(decoded[i].amount).to.equal(amounts[i]);
      }
    });

    it("should handle zero values", async function () {
      const chainIds: number[] = [0, 1];
      const amounts: number[] = [0, 0];

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(2);
      for (let i = 0; i < 2; i++) {
        expect(decoded[i].chainId).to.equal(chainIds[i]);
        expect(decoded[i].amount).to.equal(amounts[i]);
      }
    });

    it("should handle mixed big numbers and regular numbers", async function () {
      const chainIds = [1, 137];
      const amounts = [
        ethers.parseEther("1.5"),
        BigInt(2000)
      ];

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(2);
      expect(decoded[0].chainId).to.equal(chainIds[0]);
      expect(decoded[0].amount).to.equal(amounts[0]);
      expect(decoded[1].chainId).to.equal(chainIds[1]);
      expect(decoded[1].amount).to.equal(amounts[1]);
    });

    it("should reject empty arrays", async function () {
      const chainIds: number[] = [];
      const amounts: number[] = [];

      await expect(
        encoding.encode(chainIds, amounts)
      ).to.be.revertedWith("At least one repayment required");
    });

    it("should reject mismatched array lengths", async function () {
      const chainIds: number[] = [1, 2];
      const amounts: number[] = [1000];

      await expect(
        encoding.encode(chainIds, amounts)
      ).to.be.revertedWith("Array lengths must match");
    });

    it("should reject invalid encoded length", async function () {
      const invalidData: Uint8Array = ethers.randomBytes(63);

      await expect(
        encoding.decode(invalidData)
      ).to.be.revertedWith("Invalid data length");
    });

    it("should handle random valid inputs", async function () {
      const numEntries = Math.floor(Math.random() * 10) + 1;
      const chainIds: number[] = [];
      const amounts: BigInt[] = [];

      for (let i = 0; i < numEntries; i++) {
        chainIds.push(Math.floor(Math.random() * 1000000) + 1);
        amounts.push(
          ethers.parseEther(
            (Math.random() * 1000000).toFixed(18)
          )
        );
      }

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(numEntries);
      for (let i = 0; i < numEntries; i++) {
        expect(decoded[i].chainId).to.equal(chainIds[i]);
        expect(decoded[i].amount).to.equal(amounts[i]);
      }
    });

    it("should handle large arrays", async function () {
      const chainIds: number[] = Array(100).fill(0).map((_, i) => i + 1);
      const amounts: BigInt[] = Array(100).fill(0).map(() => 
        ethers.parseEther("1.0")
      );

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(100);
      for (let i = 0; i < 100; i++) {
        expect(decoded[i].chainId).to.equal(chainIds[i]);
        expect(decoded[i].amount).to.equal(amounts[i]);
      }
    });

    it("should handle common EVM chain IDs", async function () {
      const chainIds = [
        1,      // Ethereum Mainnet
        137,    // Polygon
        42161,  // Arbitrum One
        10,     // Optimism
        56,     // BSC
        43114   // Avalanche
      ];
      const amounts = chainIds.map(() => ethers.parseEther("1.0"));

      const encoded = await encoding.encode(chainIds, amounts);
      const decoded = await encoding.decode(encoded);

      expect(decoded.length).to.equal(chainIds.length);
      for (let i = 0; i < chainIds.length; i++) {
        expect(decoded[i].chainId).to.equal(chainIds[i]);
        expect(decoded[i].amount).to.equal(amounts[i]);
      }
    });

    it("should handle sequential encoding and decoding", async function () {
      // First encoding
      const chainIds1 = [1, 2];
      const amounts1 = [
        ethers.parseEther("1.0"),
        ethers.parseEther("2.0")
      ];
      
      // Second encoding
      const chainIds2 = [3, 4];
      const amounts2 = [
        ethers.parseEther("3.0"),
        ethers.parseEther("4.0")
      ];

      const encoded1 = await encoding.encode(chainIds1, amounts1);
      const encoded2 = await encoding.encode(chainIds2, amounts2);
      
      const decoded1 = await encoding.decode(encoded1);
      const decoded2 = await encoding.decode(encoded2);

      // Verify first encoding
      expect(decoded1.length).to.equal(2);
      expect(decoded1[0].chainId).to.equal(chainIds1[0]);
      expect(decoded1[0].amount).to.equal(amounts1[0]);
      expect(decoded1[1].chainId).to.equal(chainIds1[1]);
      expect(decoded1[1].amount).to.equal(amounts1[1]);

      // Verify second encoding
      expect(decoded2.length).to.equal(2);
      expect(decoded2[0].chainId).to.equal(chainIds2[0]);
      expect(decoded2[0].amount).to.equal(amounts2[0]);
      expect(decoded2[1].chainId).to.equal(chainIds2[1]);
      expect(decoded2[1].amount).to.equal(amounts2[1]);
    });
  });
});