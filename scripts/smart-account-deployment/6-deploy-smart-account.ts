import { ethers } from "hardhat";
import * as testnetContracts from "../../config/testnetContracts.json";
import {
	ARB_SEPOLIA_SLUG,
	OP_SEPOLIA_SLUG,
	MONAD_TEST_SLUG,
} from "../demo/socket/constants";

async function main() {
	const [deployer] = await ethers.getSigners();
	console.log("Deploying SmartAccount with the account:", deployer.address);

	const currentSlug = ARB_SEPOLIA_SLUG;

	// Get required addresses
	const factoryAddress = testnetContracts[currentSlug].smartAccountFactoryV1;
	const enclaveRegistry = testnetContracts[currentSlug].enclaveRegistry;

	// The owner address for the smart account (this can be an EOA or another contract)
	const ownerAddress = deployer.address;

	// Connect to the factory contract
	const SmartAccountFactoryV1 = await ethers.getContractFactory(
		"SmartAccountFactoryV1"
	);
	const factory = SmartAccountFactoryV1.attach(factoryAddress) as any;

	const salt =
		"0x0000000000000000000000000000000000000000000000000000000000000000";

	// Create the SmartAccount
	const tx = await factory.createAccount(ownerAddress, enclaveRegistry, salt);

	console.log("Transaction hash:", tx.hash);

    return;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
