import { ethers } from "hardhat";
import * as testnetContracts from "../../../../config/testnetContracts.json";
import { ARB_SEPOLIA_SLUG, MONAD_TEST_SLUG, ODYSSEY_SLUG, OP_SEPOLIA_SLUG } from "../../../demo/socket/constants";

async function main() {
    const [deployer, secondAddress] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Second address:", secondAddress.address);

    // Get the network configuration
    const ACTIVE_SLUG = MONAD_TEST_SLUG;

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockToken = await MockUSDC.deploy(
        "Mock Token",
        "MTK"
    );
    await mockToken.waitForDeployment();

    // const mockToken = MockUSDC.attach(testnetContracts[ACTIVE_SLUG].token);
    console.log("MockToken deployed to:", mockToken.target);

    // Get vault contract instance
    const VaultFactory = await ethers.getContractFactory("EnclaveVirtualLiquidityVault");
    const vault = VaultFactory.attach(testnetContracts[ACTIVE_SLUG].vault);
    console.log("Using vault at:", vault.target);

    // Mint 1 million tokens to vault
    const vaultMintAmount = ethers.parseEther("1000000");
    await mockToken.mint(vault.target, vaultMintAmount);
    console.log(`Minted ${ethers.formatEther(vaultMintAmount)} tokens to vault`);

    // Mint 1000 tokens to second address
    // const secondAddressMintAmount = ethers.parseEther("1000");
    // await mockToken.mint(secondAddress.address, secondAddressMintAmount);
    // console.log(`Minted ${ethers.formatEther(secondAddressMintAmount)} tokens to second address`);

    // // Approve vault to spend tokens from second address
    // await mockToken.connect(secondAddress).approve(vault.target, secondAddressMintAmount);
    // console.log("Approved vault to spend tokens from second address");

    // // Deposit tokens from second address to vault
    // await vault.connect(secondAddress).deposit(mockToken.target, secondAddressMintAmount);
    // console.log(`Deposited ${ethers.formatEther(secondAddressMintAmount)} tokens from second address to vault`);

    // Print final balances
    const vaultBalance = await mockToken.balanceOf(vault.target);
    const secondAddressBalance = await mockToken.balanceOf(secondAddress.address);
    const secondAddressDeposit = await vault.deposits(mockToken.target, secondAddress.address);

    console.log("\nFinal Balances:");
    console.log(`Vault Token Balance: ${ethers.formatEther(vaultBalance)}`);
    console.log(`Second Address Token Balance: ${ethers.formatEther(secondAddressBalance)}`);
    console.log(`Second Address Deposit in Vault: ${ethers.formatEther(secondAddressDeposit)}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
