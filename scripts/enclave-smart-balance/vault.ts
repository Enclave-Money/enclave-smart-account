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
    const userAddress = "0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959";
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const proof = abiCoder.encode(['address'], [userAddress]);

    console.log("Proof: ", proof);
    const tokenAddress = "0xf09156042741F67F8099D17eB22638F01F97974b"; // op sep
    // const tokenAddress = "0x1CD873d27D145523C0cf2b71D42eE15ba7D91b7b"; // arb sep

    // const vault = await deployVault();

    // const vaultAddress = "0x2038659305382987bF0722384711FE55c5096c92"; // arb sep
    const vaultAddress = "0xeBEA90FeD3e2f9130c7e6B39376a110F379c13e7"; // op sep
    const vault = await getVault(vaultAddress);

    console.log("Vault deployed to: ", vaultAddress);

    // @ts-ignore
    const deposit = await vault.deposits(tokenAddress, userAddress);

    console.log("Deposit: ", deposit);

    // @ts-ignore
    // const tx = await vault.claim(tokenAddress, deposit, proof);
    // const receipt = await tx.wait();

    // console.log("Claimed: ", receipt);
}

main();

// Export the functions
export { deployVault, getVault };
