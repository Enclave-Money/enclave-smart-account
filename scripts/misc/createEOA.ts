import { ethers } from "hardhat";

async function main() {
    console.log("Creating new Ethereum wallet (EOA)...\n");
    
    // Create a new random wallet
    const wallet = ethers.Wallet.createRandom();
    
    console.log("✅ New Ethereum wallet created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📍 Address:     ${wallet.address}`);
    console.log(`🔑 Private Key: ${wallet.privateKey}`);
    console.log(`🌱 Mnemonic:    ${wallet.mnemonic?.phrase}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n⚠️  IMPORTANT: Keep your private key and mnemonic secure!");
    console.log("   Never share them with anyone or commit them to version control.");
}

// Handle errors properly
main().catch((error) => {
    console.error("❌ Error creating wallet:", error);
    process.exitCode = 1;
}); 