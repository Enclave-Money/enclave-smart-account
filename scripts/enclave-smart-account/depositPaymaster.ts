import { ethers } from "hardhat";

// Import EnclaveTokenVerifyingPaymaster abi
import { abi as EnclaveVerifyingTokenPaymasterAbi } from "../../artifacts/contracts/enclave-smart-account/paymaster/EnclaveVerifyingTokenPaymaster.sol/EnclaveVerifyingTokenPaymaster.json";
import { abi as EntryPointAbi } from "../../artifacts/@account-abstraction/contracts/core/EntryPoint.sol/EntryPoint.json";

async function main() {
    const verifyingSigner = await ethers.provider.getSigner();

    // Attach enclave registry

    const paymasterAddress = "0xB94E8384d6b68b28d87Fb216236637c2e8F27109"; // replace with the owner's address
    const entryPointAddress = "0x10D2b2c1b32b0E47299BFbF6eC078F0E1CE1DbCe"

    // Get a contract instance
    // const ERC20 = await ethers.getContractFactory("MockUSDC");
    // const tokenContract = ERC20.attach(usdcAddress);

    const paymaster = new ethers.Contract(paymasterAddress, EnclaveVerifyingTokenPaymasterAbi, verifyingSigner);
    const entryPoint = new ethers.Contract(entryPointAddress, EntryPointAbi, verifyingSigner);

    console.log(await paymaster.entryPoint());

    // mint some tokens to address
    // await paymaster.deposit({value:ethers.parseEther("0.01")});
    const deposits = await entryPoint.deposits(paymasterAddress);
    console.log(deposits);

    // Get the allowance
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});