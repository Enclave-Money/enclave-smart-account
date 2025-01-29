// akshay2@MacBook-Pro enclave-smart-account % npx hardhat run scripts/demo/socket/4.deployTestToken.ts --network opSepolia 
// DummyToken deployed to: 0x45C0f757D4eABc8E636DE4C92d68E0474C1F1D12
// akshay2@MacBook-Pro enclave-smart-account % npx hardhat run scripts/demo/socket/4.deployTestToken.ts --network odyssey  
// DummyToken deployed to: 0x9c6c2ac4639303f034755171F07C4DBa3dF3232A

import { ethers } from "hardhat";
import * as testnetContracts from "../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG } from "./constants";

async function main() {
    const [deployer] = await ethers.getSigners();

    const user = deployer;

    console.log("User Address: ", user.address);


  const ACTIVE_SLUG = OP_SEPOLIA_SLUG

    
    // Amount to mint and deposit
    const AMOUNT_TO_MINT = ethers.parseEther("1000000");  // 1000 tokens
    const AMOUNT_TO_DEPOSIT = ethers.parseEther("1000000"); // 100 tokens to deposit

    // Get contract factories
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");

    // Attach to existing contracts
    const dummyToken = MockUSDC.attach(testnetContracts[ACTIVE_SLUG].usdc);
    const vault = VaultFactory.attach(testnetContracts[ACTIVE_SLUG].socket.plug);

    console.log("Starting token operations...");

    try {
        // 1. Mint tokens
        console.log("Minting tokens...");
        //@ts-ignore
        const mintTx = await dummyToken.mint(user.address, AMOUNT_TO_MINT);
        await mintTx.wait();
        console.log(`Minted ${ethers.formatEther(AMOUNT_TO_MINT)} tokens to ${user.address}`);

        // 2. Approve vault to spend tokens
        console.log("Approving vault...");
        //@ts-ignore
        const approveTx = await dummyToken.connect(deployer).approve(testnetContracts[ACTIVE_SLUG].socket.plug, AMOUNT_TO_DEPOSIT);
        await approveTx.wait();
        console.log(`Approved vault to spend ${ethers.formatEther(AMOUNT_TO_DEPOSIT)} tokens`);

        // 3. Deposit tokens into vault
        console.log("Depositing tokens into vault...");
        //@ts-ignore
        const depositTx = await vault.connect(user).deposit(testnetContracts[ACTIVE_SLUG].usdc, AMOUNT_TO_DEPOSIT);
        await depositTx.wait();
        console.log(`Successfully deposited ${ethers.formatEther(AMOUNT_TO_DEPOSIT)} tokens into vault`);

        // 4. Check balances
        //@ts-ignore
        const vaultBalance = await dummyToken.balanceOf(testnetContracts[ACTIVE_SLUG].socket.plug);
        //@ts-ignore
        const userBalance = await dummyToken.balanceOf(user.address);
        //@ts-ignore
        const depositBalance = await vault.deposits(testnetContracts[ACTIVE_SLUG].usdc, user.address);

        console.log("\nFinal Balances:");
        console.log(`Vault Token Balance: ${ethers.formatEther(vaultBalance)}`);
        console.log(`User Token Balance: ${ethers.formatEther(userBalance)}`);
        console.log(`User Deposit in Vault: ${ethers.formatEther(depositBalance)}`);

    } catch (error) {
        console.error("Error occurred:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
