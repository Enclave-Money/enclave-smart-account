// akshay2@MacBook-Pro enclave-smart-account % npx hardhat run scripts/demo/socket/4.deployTestToken.ts --network opSepolia 
// DummyToken deployed to: 0x45C0f757D4eABc8E636DE4C92d68E0474C1F1D12
// akshay2@MacBook-Pro enclave-smart-account % npx hardhat run scripts/demo/socket/4.deployTestToken.ts --network odyssey  
// DummyToken deployed to: 0x9c6c2ac4639303f034755171F07C4DBa3dF3232A

import { ethers } from "hardhat";
import * as testnetContracts from "../../../config/testnetContracts.json";
import { OP_SEPOLIA_SLUG, ODYSSEY_SLUG, ARB_SEPOLIA_SLUG } from "./constants";

async function main() {
    const [deployer] = await ethers.getSigners();

    const user = deployer;

    console.log("User Address: ", user.address);

    const ACTIVE_SLUG = OP_SEPOLIA_SLUG

    // Vault addresses from the deployment
    const vaultAddresses = {
        [OP_SEPOLIA_SLUG]: "0x57e3Cd7D6Bf7BA15c95Dcf3a71adf9056dCaF373",
        [ODYSSEY_SLUG]: "0xAd6fFcA22E0f19A47065712C1bc01Aee42C4CdA5",
        [ARB_SEPOLIA_SLUG]: "0x7d87C9A0a3F8D978bF248d6EC5F56D5ed3a03F05"
    };

    // Amount to mint and deposit
    const AMOUNT_TO_WITHDRAW = ethers.parseEther("500000");

    // Get contract factories
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");

    // Attach to existing contracts
    const dummyToken = MockUSDC.attach(testnetContracts[ACTIVE_SLUG].usdc);
    const vault = VaultFactory.attach(vaultAddresses[ACTIVE_SLUG]);

    console.log("Starting token operations...");

    try {
        // Check initial deposit balance
        //@ts-ignore
        const initialDeposit = await vault.deposits(testnetContracts[ACTIVE_SLUG].usdc, user.address);
        console.log("Initial vault deposit balance:", ethers.formatEther(initialDeposit));

        // Get withdrawal hash from vault
        //@ts-ignore
        const withdrawalHash = await vault.getWithdrawalHash(
            testnetContracts[ACTIVE_SLUG].usdc,
            0, // mode 0 for specific amount withdrawal
            AMOUNT_TO_WITHDRAW,
            user.address
        );

        // Sign the hash with the deployer (vault manager) account
        const signature = await deployer.signMessage(ethers.getBytes(withdrawalHash));

        console.log("Attempting withdrawal...");
        
        // Call withdraw with the signature
        //@ts-ignore
        const tx = await vault.connect(user).withdraw(
            testnetContracts[ACTIVE_SLUG].usdc,
            AMOUNT_TO_WITHDRAW,
            signature
        );
        
        await tx.wait();
        console.log("Withdrawal successful!");

        // Check final deposit balance
        //@ts-ignore
        const finalDeposit = await vault.deposits(testnetContracts[ACTIVE_SLUG].usdc, user.address);
        console.log("Final vault deposit balance:", ethers.formatEther(finalDeposit));

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
