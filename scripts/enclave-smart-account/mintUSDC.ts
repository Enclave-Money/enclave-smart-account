import { ethers } from "hardhat";

// Import ERC20 abi
import { abi as ERC20Abi } from "../../artifacts/contracts/MockUSDC.sol/MockUSDC.json";

//import EnclaveRegistry abi
import { abi as EnclaveRegistryAbi } from "../../artifacts/contracts/enclave-smart-account/EnclaveRegistry.sol/EnclaveRegistry.json";

async function main() {
    const verifyingSigner = await ethers.provider.getSigner();

    // Attach enclave registry

    const usdcAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
    const ownerAddress = "0x649b01D5212a8Ca9B2FfF0D5843346aeedC715C7"; // replace with the owner's address

    // Get a contract instance
    // const ERC20 = await ethers.getContractFactory("MockUSDC");
    // const tokenContract = ERC20.attach(usdcAddress);

    const mockUSDC = new ethers.Contract(usdcAddress, ERC20Abi, verifyingSigner);

    // transfer 10 ETH to the owner
    await verifyingSigner.sendTransaction({
        to: ownerAddress,
        value: ethers.parseEther("10"),
        data: "0x",
    });

    // mint some tokens to address
    await mockUSDC.mint(ownerAddress, ethers.parseEther("10000000"));

    // Get the allowance
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});