import { ethers } from "hardhat";

// Import ERC20 abi
import { abi as ERC20Abi } from "../../artifacts/contracts/MockUSDC.sol/MockUSDC.json";

//import EnclaveRegistry abi
import { abi as EnclaveRegistryAbi } from "../../artifacts/contracts/enclave-smart-account/EnclaveRegistry.sol/EnclaveRegistry.json";

async function main() {
    const verifyingSigner = await ethers.provider.getSigner();

    // Attach enclave registry

    const usdcAddress = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
    const paymasterAddress = "0x166c2b871C6011ae063Cf10feb4efd95eADC6594";
    const ownerAddress = "0xA38f83d924b9a0e339717714E156dA7f8842366d"; // replace with the owner's address

    const registry = "0x1705AC759b732Ed198875C7b97853D75325F9A06"

    // Get a contract instance
    // const ERC20 = await ethers.getContractFactory("MockUSDC");
    // const tokenContract = ERC20.attach(usdcAddress);

    const mockUSDC = new ethers.Contract(usdcAddress, ERC20Abi, verifyingSigner);

    // Get the allowance
    const allowance = await mockUSDC.allowance(ownerAddress, paymasterAddress);
    console.log(`Allowance: ${allowance.toString()}`);

    // create EnclaveRegistry contract instance
    const registryContract = new ethers.Contract(registry, EnclaveRegistryAbi, verifyingSigner);

    // Get "paymaster" key value from the enclave registry
    const paymasterKey = await registryContract.getRegistryAddress("paymaster");
    console.log(`Paymaster key: ${paymasterKey}`);

    const paymentToken = await registryContract.getRegistryAddress("paymentToken");
    console.log(`Payment Token: ${paymentToken}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});