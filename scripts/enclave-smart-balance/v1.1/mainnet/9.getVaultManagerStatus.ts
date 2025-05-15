import { ethers } from "hardhat";
import * as deploymentData from "../../../../config/mainnetDeploymentContracts.json";
import { mainnetSlugs } from "../../../../config/networks";
import { JsonRpcProvider } from "ethers";
import { RPC } from "../../../../config/rpcNodes";

async function main() {
    const addressToCheck = "0xF1Fb9a6A3436FEB0af1De39f17c7b46cf5526957";
    console.log(`Checking vault manager status for address: ${addressToCheck}\n`);

    for (const chain of mainnetSlugs) {
        try {

            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_MASTER as string, new JsonRpcProvider(RPC[chain]));
            const networkData = deploymentData[chain.toString() as keyof typeof deploymentData];

            const vault = await ethers.getContractAt("EnclaveVirtualLiquidityVault", networkData.vault, wallet);
            const isManager = await vault.isVaultManager(addressToCheck);
            
            console.log(`${chain}: ${isManager ? "✅ Is Vault Manager" : "❌ Not Vault Manager"}`);
        } catch (error) {
            console.error(`Error checking ${chain}:`, error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
