import { ethers } from "hardhat";

// Import ERC20 abi
import { abi as ERC20Abi } from "../../artifacts/contracts/MockUSDC.sol/MockUSDC.json";

async function main() {
    const wallet = new ethers.Wallet(process.env.TEST_KEY as string, ethers.provider);
    // Token contract address

    // // Monad Testnet
    // const tokenAddress = "0xD2a05eE55Bd94A8E09670281fb7c5891579A408e";
    // const recipientAddress = "0x0427634fBC64C57232B33B287343d8bF1bA36010";

    // // Optimism Sepolia
    // const tokenAddress = "0xE6Ee959cb60b8bdB86816f0f892587B745fd3667";
    // const recipientAddress = "0x0427634fBC64C57232B33B287343d8bF1bA36010";

    // Arbitrum Sepolia
    const tokenAddress = "0xA374460eb5EA5Ea29361b4Cf4053A0A822aA5250";
    const recipientAddress = "0x0427634fBC64C57232B33B287343d8bF1bA36010";

    // Get a contract instance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20Abi, wallet);

    // Mint tokens to the recipient address
    const amount = ethers.parseEther("1000000"); // Minting 1 million tokens
    const tx = await tokenContract.mint(recipientAddress, amount);
    await tx.wait();

    console.log(`Successfully minted ${ethers.formatEther(amount)} tokens to ${recipientAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 