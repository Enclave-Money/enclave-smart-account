import { ethers } from "hardhat";
import { REGISTRY_KEYS } from "../../../config/enclaveRegistryKeys";
import { EnclaveRegistry } from "../../../typechain-types";
import * as mainnetContracts from "../../../config/mainnetContracts.json";
import { ARB_MAIN_SLUG, OP_MAIN_SLUG, BASE_MAIN_SLUG } from "../../../config/networks";

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Using signer address:", signer.address);

    const activeNetwork = BASE_MAIN_SLUG;

    // Get the EnclaveRegistry contract instance
    const registryAddress = mainnetContracts[activeNetwork].enclaveRegistry;
    if (!registryAddress) {
        throw new Error("ENCLAVE_REGISTRY_ADDRESS environment variable not set");
    }

    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    const registry = EnclaveRegistry.attach(registryAddress) as EnclaveRegistry;

    console.log("\nFetching registry values...");
    console.log("=========================================");

    // Fetch and print all registry values
    for (const [key, value] of Object.entries(REGISTRY_KEYS)) {
        try {
            const address = await registry.getRegistryAddress(value);
            const bytes32Value = ethers.keccak256(ethers.solidityPacked(['string'], [value]));
            console.log(`${key}:`);
            console.log(`  String value: ${value}`);
            console.log(`  Bytes32 value: ${bytes32Value}`);
            console.log(`  Registry address: ${address}`);
        } catch (error) {
            console.log(`${key}: Not set or error fetching value`);
        }
    }

    console.log("=========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
