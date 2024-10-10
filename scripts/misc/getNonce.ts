import { ethers } from "hardhat";

async function main() {
    const address = "0xFe7bd528ec2375a3d6Bd3fB37E55f6BD7ae229aa"; // Replace with the specified address
    const provider = ethers.provider; // Use the default provider

    // Get the nonce for the specified address
    const nonce = await provider.getTransactionCount(address);
    console.log(`Nonce for address ${address}:`, nonce);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});