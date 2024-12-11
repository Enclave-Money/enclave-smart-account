import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());
    // Get the account factory contract instance
    const registryFac = await ethers.getContractFactory("EnclaveRegistry");
    const registryContract = registryFac.attach("0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47");


    let tx;

    const CHAIN = 42161;

    // const vault = {
    //     42161: "0xABeFc3103d18CD3ba0c86E5471a5BBB18F84D9B6",
    //     10: "0xABeFc3103d18CD3ba0c86E5471a5BBB18F84D9B6",
    //     8453: "0xABeFc3103d18CD3ba0c86E5471a5BBB18F84D9B6"
    // }

    const vault = {
        42161: "0x11DCe5ef6E4ADD33c694611da2E205B87Edd23FE",
        10: "0x11DCe5ef6E4ADD33c694611da2E205B87Edd23FE",
        8453: "0x11DCe5ef6E4ADD33c694611da2E205B87Edd23FE"
    }

    const smartBalanceConversionManager = {
        42161: "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00",
        10: "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00",
        8453: "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00"
    }

    const validator = {
        42161: "0x5c9373E35Bd54E4eEeC5284AEA97f3419AdD3a6b",
        10: "0x5D470c5D14F1B771e1Fc4f67B398c0a59D425BAC",
        8453: "0x52B74358ef7c0C95E106FfCb2aDd6dFb8DF58aFb"
    }


    //@ts-ignore
    // tx = await registryContract.updateRegistryAddress("P256Validator", validator[CHAIN]);
    // await tx.wait();
    // //@ts-ignore
    // console.log("Updated validator: ", await registryContract.getRegistryAddress("P256Validator"));

    // //@ts-ignore
    // tx = await registryContract.updateRegistryAddress("smartBalanceConversionManager", smartBalanceConversionManager[CHAIN]);
    // await tx.wait();
    // //@ts-ignore
    // console.log("Updated manager: ", await registryContract.getRegistryAddress("smartBalanceConversionManager"));

    //@ts-ignore
    tx = await registryContract.updateRegistryAddress("smartBalanceVault", vault[CHAIN]);
    await tx.wait();
    //@ts-ignore
    console.log("Updated vault: ", await registryContract.getRegistryAddress("smartBalanceVault"));
    // Udpate registry
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});