const { expect } = require("chai");

import { ethers } from "hardhat";
import { AbiCoder } from "ethers";

describe("EnclaveSolverPaymasterV2", function () {
  let TestNFT: any, testNFT: any, owner: any, addr1: any, addr2: any, addr3: any;
  let ERC20: any, mockToken: any;
  let paymaster: any;

  const abiCoder = new AbiCoder();

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy EnclaveSolverPaymasterV1Patch
    const PaymasterFactory = await ethers.getContractFactory("EnclaveSolverPaymasterV2");
    paymaster = await PaymasterFactory.deploy("0xF522AA3eC4dA6237a9570021AB6187Ca111aa8b3", "0x399e8917Cd7Ce367b06bFfd0863E465B0Fd950dB");
    await paymaster.waitForDeployment();
  });

  describe("parsePaymasterAndData", function () {
    it("should parse paymaster and data correctly", async function () {
      const data = "0xada592b297ab5a01b0d0563eebb692de461ad92a00000000000000000000000000000000000000000000000000000000670f9ed100000000000000000000000000000000000000000000000000000000670f90c10000000000000000000000005fd84259d66cd46123540766be93dfe6d43130d700000000000000000000000000000000000000000000000000000000000fb7700c6b7da378f907dae459e6d26727238f19ac2fb9fa712c9b6de4aad7292916cc1e912fa9a42ef04b8e09afb7aa0f0a48f4b12f21debfcaf9749b2067d0d5502c1b"; // Replace with actual data to parse
      const result = await paymaster.parsePaymasterAndData(data);
      console.log("Parsed result: ", result);
      // Add assertions based on expected output
    });
  });
});
