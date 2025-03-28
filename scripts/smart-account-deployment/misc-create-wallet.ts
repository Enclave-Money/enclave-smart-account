import { ethers } from "ethers";

async function main() {
  console.log("Generating a new wallet...");
  
  // Generate a random wallet
  const wallet = ethers.Wallet.createRandom();
  
  // Get wallet details
  const address = wallet.address;
  const privateKey = wallet.privateKey;
  const mnemonic = wallet.mnemonic?.phrase;
  
  console.log("Wallet created successfully!");
  console.log("-------------------------------------");
  console.log(`Address:     ${address}`);
  console.log(`Private Key: ${privateKey}`);
  
  if (mnemonic) {
    console.log(`Mnemonic:    ${mnemonic}`);
  }
  
  console.log("-------------------------------------");
  console.log("IMPORTANT: Save these details securely. If you lose your private key, you'll lose access to your wallet!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 