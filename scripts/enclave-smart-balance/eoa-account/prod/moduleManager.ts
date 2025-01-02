import { ethers } from "hardhat";

async function main() {
    // Deploy EnclaveModuleManager
    const [signer] = await ethers.getSigners();
    console.log("Signer: ", signer.address);

    const registryAddress = "0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47"
    const currentNetwork = 42161

    const validators = {
        42161: {
            moduleManager: "0x11D6D819e3559F0250FD37F95408E70DCD9727da",
            simpleSessionKeyValidator: "0xE583Dc8f5459Ebb61f289779e56B053C571B33ce",
            smartAccountECDSAValidator: "0xE9c7cE37eDcfAEb26023978d915361d5169b4Cd4",
            smartBalanceConvertValidator:  "0x9e529DDC00E7d150aF53E8dE14503bCB39fd42f5",
        },
        10: {
            moduleManager: "0xf1acF547Fae428Ad5BC8f45FE065Bc66ecDe072f",
            simpleSessionKeyValidator: "0x5110905eC162E48F4B5C269C6fb0fE1c3AD86aAE",
            smartAccountECDSAValidator: "0xC5e14E0ceE95454488B9EcC885225C542e1C632C",
            smartBalanceConvertValidator:  "0xc1D5A3f3a884588Abe830166281B76a15B7c8CB2",
        },
        8453: {
            moduleManager: "0x54388021a3E655936bdce4a4bb6c54157cDdEEe7",
            simpleSessionKeyValidator: "0x8dfD91356c41BbEe12f6D8e658874D0EDe2C63ea",
            smartAccountECDSAValidator: "0x02E991c16cC6941C64ea5462454729a338022694",
            smartBalanceConvertValidator:  "0x145f75d62EE0762d166295D2d4bffdF4fF41c0F8",
        }
    }

    const EnclaveModuleManager = await ethers.getContractFactory("EnclaveModuleManager");
    // const enclaveModuleManager = await EnclaveModuleManager.deploy(registryAddress);
    // await enclaveModuleManager.waitForDeployment();
    const enclaveModuleManager = EnclaveModuleManager.attach(validators[currentNetwork].moduleManager);
    const enclaveModuleManagerAddress = await enclaveModuleManager.getAddress();
    console.log(`EnclaveModuleManager deployed to: ${enclaveModuleManagerAddress}`);

    // Update EnclaveRegistry with module manager address
    // const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    // const enclaveRegistry = EnclaveRegistry.attach(registryAddress);
    // //@ts-ignore
    // let tx = await enclaveRegistry.updateRegistryAddress("moduleManager", enclaveModuleManagerAddress);
    // await tx.wait();
    // console.log("Updated EnclaveRegistry with module manager address");
    // //@ts-ignore
    // tx = await enclaveRegistry.updateRegistryAddress("moduleManagerEoa", signer.address);
    // await tx.wait();
    // console.log("Updated EnclaveRegistry with module manager address");

    // Update with simpleSessionKeyValidator
    //@ts-ignore
    let tx = await enclaveModuleManager.enableModule(validators[currentNetwork].smartBalanceConvertValidator);
    await tx.wait();
    console.log("Enabled simpleSessionKeyValidator");

    // Update with smartAccountECDSAValidator
    // tx = await enclaveModuleManager.enableModule(validators[currentNetwork].smartAccountECDSAValidator);
    // await tx.wait();
    // console.log("Enabled simpleSessionKeyValidator");

    
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
