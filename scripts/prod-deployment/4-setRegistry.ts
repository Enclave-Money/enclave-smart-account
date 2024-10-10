import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());
    // Get the EnclaveRegistry contract instance
    const ownerAdd = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00";
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    const enclaveRegistry = EnclaveRegistry.attach("0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47")
    console.log("Deployed Registry: ", await enclaveRegistry.getAddress());

    const m = {
        // entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        entryPoint: "0x19570561C424B0D2D8F9690B55F966560aB5C391",
        p256Verifier: "0x232fCFD3DB08926B387dCF31d00AD23da705402a",
    }

    //@ts-ignore
    // const res = await enclaveRegistry.updateRegistryAddress("entryPoint", m.entryPoint);
    // console.log(res);
    
    //@ts-ignore
    const verifyValue = await enclaveRegistry.getRegistryAddress("entryPoint");
    console.log("Res: ", verifyValue);

    //@ts-ignore
    // const res2 = await enclaveRegistry.updateRegistryAddress("p256Verifier", m.p256Verifier);
    // console.log(res2);
    
    //@ts-ignore
    // const verifyValue2 = await enclaveRegistry.getRegistryAddress("p256Verifier");
    // console.log("Res2: ", verifyValue2);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});