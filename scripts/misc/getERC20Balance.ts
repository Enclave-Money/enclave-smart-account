import { ethers } from "hardhat";

async function main() {
    // const walletAddress = '0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00';
    // const walletAddress = '0xFe7bd528ec2375a3d6Bd3fB37E55f6BD7ae229aa';
    const walletAddress = '0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959';
    // const tokenAddress = '0xf09156042741F67F8099D17eB22638F01F97974b'; // OP SEP
    const tokenAddress = '0x1CD873d27D145523C0cf2b71D42eE15ba7D91b7b'; // ARB SEP

    const tokenContract = await ethers.getContractAt('ERC20', tokenAddress);
    const balance = await tokenContract.balanceOf(walletAddress);
    console.log("Balance: ", balance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});