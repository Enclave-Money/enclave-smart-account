import { ethers } from "hardhat";
import crypto from "crypto";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());

    const publicKeyArr = [
        "0xb3ef0eb6729d78ff039b7d99dbebef10d15151e12c2750cc3e9906ff18e077dc",
        "0xc5928d1c4b8b56c27e3361afe6c3c9f4b78da21c9a75eedaf41de1503f5ec80f"
    ]

    const clientDataJSON = '{"type":"webauthn.get","challenge":"wWmDIw57b4Wd14S4MkzJoSzrd_rcpvAzMAZDCUmM1MM","origin":"http://localhost:8000","crossOrigin":false}'
    const authenticatorData = new Uint8Array([
        73, 150,  13, 229, 136,  14, 140, 104, 116,
       52,  23,  15, 100, 118,  96,  91, 143, 228,
      174, 185, 162, 134,  50, 199, 153,  92, 243,
      186, 131,  29, 151,  99,  29,   0,   0,   0,
        0
    ]);

    const hash = crypto.createHash('sha256');
    hash.update(clientDataJSON);
    const clientDataHash = hash.digest();
    console.log({clientDat: clientDataHash.toString('hex')})
    // Concatenate the authenticatorData and clientDataHash
    const concatenatedData = Buffer.concat([Buffer.from(authenticatorData), clientDataHash]);
    // Convert to hex string

    console.log(concatenatedData);
    const hash2 = crypto.createHash('sha256');
    hash2.update(concatenatedData);
    const hash2Digest = hash2.digest();
    console.log("Yolo: ", hash2Digest.toString('hex'));

    const signature = {
        r: 68451300771154902330033335987224646117671067567357512230763650650451954468791n,
        s: 112777508870135633727467010426564055435309001218801459625679345492236984478291n
    }

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entrypoint = await EntryPoint.deploy();
    await entrypoint.waitForDeployment();
    console.log("Deployed entrypoint: ", await entrypoint.getAddress());

    const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
    const p256VerifierX = await P256VerifierFactory.deploy();
    await p256VerifierX.waitForDeployment();
    console.log("1. Mock P256 precompile: ", p256VerifierX.target);


    const p256VerifierFactory = await ethers.getContractFactory("P256V");
    // const p256verifier = p256VerifierFactory.attach("0x0056DEDa33aC4Fab7ADAD39A20c10196CeB5cd27");
    // const p256verifier = p256VerifierFactory.attach("0x232fCFD3DB08926B387dCF31d00AD23da705402a");

    // const p256verifier = await p256VerifierFactory.deploy("0x0000000000000000000000000000000000000100");
    const p256verifier = await p256VerifierFactory.deploy(p256VerifierX.target);
    await p256verifier.waitForDeployment();
    // const p256verifier = p256VerifierFactory.attach("0xe4fc1002E56cf8deDCE7b69ba94c88a47feb6500");
    console.log("2. P256V deployed to: ", p256verifier.target);

    //@ts-ignore
    const precompile = await p256verifier.precompile();
    console.log("Precompile: ", precompile);

     //@ts-ignore
     const res = await p256verifier.verify(hash2Digest, signature.r, signature.s, publicKeyArr);
     console.log("Res: ", res);

    // Get the EnclaveRegistry contract instance
    // const ownerAdd = "0xD02Fd04e15a595019b7c60Eb257B3B7D333F6C00";
    const ownerAdd = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const EnclaveRegistry = await ethers.getContractFactory("EnclaveRegistry");
    const enclaveRegistry = await EnclaveRegistry.deploy(ownerAdd);
    await enclaveRegistry.waitForDeployment();
    console.log("Deployed Registry: ", await enclaveRegistry.getAddress());

    const P256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactoryV1");
    const p256SmartAccountFactory = await P256SmartAccountFactory.deploy();
    await p256SmartAccountFactory.waitForDeployment();
    const p256SmartAccountFactoryAddress = await p256SmartAccountFactory.getAddress();
    console.log(`ENCLAVE_P256_SMART_ACCOUNT_FACTORY_V1_ADDRESS=${p256SmartAccountFactoryAddress}`);

    const getDummyAddress = await p256SmartAccountFactory.getAccountAddress([1,2], enclaveRegistry.target, 0);
    console.log("Dummy Address: ", getDummyAddress);

    const ecdsaValidatorFac = await ethers.getContractFactory("ECDSAValidator");
    const ecdsaValidator = await ecdsaValidatorFac.deploy();
    await ecdsaValidator.waitForDeployment();
    console.log("3.a. Deployed ecdsaValidator: ", await ecdsaValidator.getAddress());

    const p256ValidatorFac = await ethers.getContractFactory("P256Validator");
    const p256Validator = await p256ValidatorFac.deploy(enclaveRegistry.target);
    await p256Validator.waitForDeployment();
    console.log("3.b. Deployed p256Validator: ", await p256Validator.getAddress());

    const res1 = await enclaveRegistry.updateRegistryAddress("entryPoint", entrypoint.target);
    const res2 = await enclaveRegistry.updateRegistryAddress("p256Verifier", p256verifier.target);
    const res3 = await enclaveRegistry.updateRegistryAddress("ECDSAValidator", ecdsaValidator.target);
    const res4 = await enclaveRegistry.updateRegistryAddress("P256Validator", p256Validator.target);

    console.log("ENTRYPOINT=", await enclaveRegistry.getRegistryAddress("entryPoint"))
    console.log("P256V=", await enclaveRegistry.getRegistryAddress("p256Verifier"))
    console.log("ECDSAValidator=", await enclaveRegistry.getRegistryAddress("ECDSAValidator"))
    console.log("P256Validator=", await enclaveRegistry.getRegistryAddress("P256Validator"))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});