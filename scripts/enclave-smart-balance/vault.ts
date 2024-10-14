import { Addressable } from "ethers";
import { ethers } from "hardhat";

async function deployVault() {
    const Vault__factory = await ethers.getContractFactory("EnclaveTokenVaultV0");
    const vault = await Vault__factory.deploy();
    await vault.waitForDeployment();

    console.log("Vault deployed to: ", vault.target);
    return vault;
}

async function getVault(address: string | Addressable) {
    const Vault__factory = await ethers.getContractFactory("EnclaveTokenVaultV0");
    const vault = Vault__factory.attach(address);
    return vault;
}

async function main() {
    const vault = await deployVault();
    const vaultAddress = vault.target;
    console.log("Vault deployed to: ", vaultAddress);
}

main();

// Export the functions
export { deployVault, getVault };
