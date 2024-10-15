const { expect } = require("chai");

import { ethers } from "hardhat";
import { AbiCoder } from "ethers";

describe("TestNFT", function () {
  let TestNFT: any, testNFT: any, owner: any, addr1: any, addr2: any, addr3: any;
  let ERC20: any, mockToken: any;

  const abiCoder = new AbiCoder();

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy mock ERC20 token
    ERC20 = await ethers.getContractFactory("MockUSDC");
    mockToken = await ERC20.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    console.log("Mock token deployed to: ", mockToken.target);

    // Deploy TestNFT
    TestNFT = await ethers.getContractFactory("TestNFT");
    testNFT = await TestNFT.deploy(1000000, mockToken.target);
    await testNFT.waitForDeployment();

    console.log("TestNFT deployed to: ", testNFT.target);
    console.log("TestNFT mint price: ", await testNFT.mintPrice());
    console.log("TestNFT usdc: ", await testNFT.usdc());

    // mint token to addr1
    await mockToken.mint(addr1.address, 1000000);
    console.log("Mock token minted to addr1");

  });

  describe("mintNFT", function () {
    it("should mint NFT to the caller", async function () {
        // Add allowance to testNFT

        // balance of mock token
        console.log("Balance of mock token: ", await mockToken.balanceOf(addr1.address));
        await mockToken.connect(addr1).approve(testNFT.target, 1000000);
        const tx = await testNFT.connect(addr1).mintNFT(addr1.address);
        await tx.wait();
      expect(await testNFT.ownerOf(1)).to.equal(addr1.address);
    });
  });

  
});

