const { ethers } = require("hardhat");

async function main() {
  const P256Verifier = await ethers.getContractFactory("P256Verifier");
  const p256Verifier = await P256Verifier.deploy();
  await p256Verifier.waitForDeployment();
  console.log(`Address of p256Verifier is ${await p256Verifier.getAddress()}`)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

// arbSepolia--> 0xf4Bd13DEA635266Ee82d8d5bE06a7df9E83C5B40