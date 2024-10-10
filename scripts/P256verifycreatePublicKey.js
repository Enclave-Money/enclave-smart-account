const { ethers } = require("hardhat");
const { p256 } = require("@noble/curves/p256");
const EC = require("elliptic").ec;
const { decodeBase64 } = require("ethers");
const crypto = require("crypto");

const getMessageHash = () => {
  const clientDataJSON = '{"type":"webauthn.get","challenge":"JuFWdIR6III19kve1w96Tr6WPFuGx2UnTybH1mJbcJM","origin":"http://localhost:8000","crossOrigin":false,"other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"}'
    const authenticatorData = new Uint8Array([
        73, 150,  13, 229, 136,  14, 140, 104, 116,
        52,  23,  15, 100, 118,  96,  91, 143, 228,
       174, 185, 162, 134,  50, 199, 153,  92, 243,
       186, 131,  29, 151,  99,  29,   0,   0,   0,
         0
    ]);

    const authdata2 = decodeBase64("SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA")
    console.log(authdata2)
    const hash = crypto.createHash('sha256');
    hash.update(clientDataJSON);
    const clientDataHash = hash.digest();
    console.log({clientDat: clientDataHash.toString('hex')})
    // Concatenate the authenticatorData and clientDataHash
    const concatenatedData = Buffer.concat([Buffer.from(authdata2), clientDataHash]);
    // Convert to hex string

    console.log(concatenatedData);
    const hash2 = crypto.createHash('sha256');
    hash2.update(concatenatedData);
    const hash2Digest = hash2.digest();
    console.log("Yolo: ", hash2Digest.toString('hex'));
    return hash2Digest.toString('hex');
}

async function main() {
  // const P256Verifier = await ethers.getContractFactory("P256Verifier");
  // const p256Verifier = await P256Verifier.deploy();
  // await p256Verifier.waitForDeployment();
  // console.log(`Address of p256Verifier is ${await p256Verifier.getAddress()}`)
  const privKey = p256.utils.randomPrivateKey();
  console.log({privKey});
  const pubKey = p256.getPublicKey(privKey);


  console.log("PubKey : ", pubKey);

 
  const ec = new EC("p256");
  // Convert Uint8Array to hexadecimal string for x
    const privKey2 = ec.keyFromPublic(pubKey);
    console.log({privKey2});

    console.log("PublicKey2 Hex: ", privKey2.getPublic("hex"));
    const publicKey = [
        "0x" + privKey2.getPublic("hex").slice(2, 66),
        "0x" + privKey2.getPublic("hex").slice(-64),
      ];
    console.log(publicKey);
  console.log(pubKey);
  const msgHash = getMessageHash();
  console.log(msgHash);
// //     const r = BigInt("19738613187745101558623338726804762177711919211234071563652772152683725073944");
// //     const s = BigInt("34753961278895633991577816754222591531863837041401341770838584739693604822390");
// //     const x = BigInt("18614955573315897657680976650685450080931919913269223958732452353593824192568");
// //    const  y = BigInt("90223116347859880166570198725387569567414254547569925327988539833150573990206");
  const signature = p256.sign(msgHash.substring(2), privKey);
  console.log(signature);
  console.log(p256.verify(signature, msgHash.substring(2), privKey2.getPublic("hex")));
//   const result = await p256Verifier.ecdsa_verify(msgHash, signature.r, signature.s, [publicKey[0], publicKey[1]]);
//   console.log(result);

  // await enclaveRegistry.getRegistryAddress("converter");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
