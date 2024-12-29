import { ethers } from "hardhat";

async function main() {
    // Deploy EnclaveModuleManager
    const [signer] = await ethers.getSigners();
    console.log("Signer: ", signer.address);

    const registryAddress = "0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47"
    const currentNetwork = 8453

    const validators = {
        42161: {
            simpleSessionKeyValidator: "0xE583Dc8f5459Ebb61f289779e56B053C571B33ce",
            smartAccountECDSAValidator: "0xE9c7cE37eDcfAEb26023978d915361d5169b4Cd4"
        },
        10: {
            simpleSessionKeyValidator: "0x5110905eC162E48F4B5C269C6fb0fE1c3AD86aAE",
            smartAccountECDSAValidator: "0xC5e14E0ceE95454488B9EcC885225C542e1C632C"
        },
        8453: {
            simpleSessionKeyValidator: "0x8dfD91356c41BbEe12f6D8e658874D0EDe2C63ea",
            smartAccountECDSAValidator: "0x02E991c16cC6941C64ea5462454729a338022694"
        }
    }

    const EnclaveModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
    const enclaveModuleManager = await EnclaveModuleManager.deploy(registryAddress);
    await enclaveModuleManager.waitForDeployment();
    const enclaveModuleManagerAddress = await enclaveModuleManager.getAddress();
    console.log(`EnclaveModuleManager deployed to: ${enclaveModuleManagerAddress}`);

    // Update EnclaveRegistry with module manager address
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    const enclaveRegistry = EnclaveRegistry.attach(registryAddress);
    //@ts-ignore
    let tx = await enclaveRegistry.updateRegistryAddress("moduleManager", enclaveModuleManagerAddress);
    await tx.wait();
    console.log("Updated EnclaveRegistry with module manager address");
    //@ts-ignore
    tx = await enclaveRegistry.updateRegistryAddress("moduleManagerEoa", signer.address);
    await tx.wait();
    console.log("Updated EnclaveRegistry with module manager address");

    // Update with simpleSessionKeyValidator
    tx = await enclaveModuleManager.enableModule(validators[currentNetwork].simpleSessionKeyValidator);
    await tx.wait();
    console.log("Enabled simpleSessionKeyValidator");

    // Update with smartAccountECDSAValidator
    tx = await enclaveModuleManager.enableModule(validators[currentNetwork].smartAccountECDSAValidator);
    await tx.wait();
    console.log("Enabled simpleSessionKeyValidator");

    
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
