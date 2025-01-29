import { ethers } from "hardhat";
import * as testnetContracts from "../../../config/testnetContracts.json";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Get USDC address for Odyssey from testnetContracts.json
    const odysseyUSDC = testnetContracts["911867"].usdc;
    console.log("Using USDC address:", odysseyUSDC);

    // Set mint price (for example, 10 USDC = 10 * 10^6)

    // Deploy TestNFT contract
    const TestNFT = await ethers.getContractFactory("OdysseyNFT");
    const testNFT = await TestNFT.deploy(odysseyUSDC);
    await testNFT.waitForDeployment();

    const testNFTAddress = await testNFT.getAddress();
    console.log("MintNFT deployed to:", testNFTAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
