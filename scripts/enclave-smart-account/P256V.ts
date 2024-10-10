import { ethers } from "hardhat";
const { p256 } = require("@noble/curves/p256");
const EC = require("elliptic").ec;
import crypto from "crypto";
import { decodeBase64 } from "ethers";


async function main() {
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

    // const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
    // const p256VerifierX = await P256VerifierFactory.deploy();
    // console.log("Mock P256 precompile: ", p256VerifierX.target);


    const p256VerifierFactory = await ethers.getContractFactory("P256V");
    // const p256verifier = p256VerifierFactory.attach("0x0056DEDa33aC4Fab7ADAD39A20c10196CeB5cd27");
    const p256verifier = p256VerifierFactory.attach("0x232fCFD3DB08926B387dCF31d00AD23da705402a");

    // const p256verifier = await p256VerifierFactory.deploy();
    console.log("P256V deployed to: ", p256verifier.target);
    // const p256verifier = p256VerifierFactory.attach("0x0000000000000000000000000000000000000100");

    //@ts-ignore
    const res = await p256verifier.verify(hash2Digest, signature.r, signature.s, publicKeyArr);
    console.log("Res: ", res);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});