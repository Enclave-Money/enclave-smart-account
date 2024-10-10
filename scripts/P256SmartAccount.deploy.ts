import { ethers } from "hardhat";

async function main() {
  const P256SmartAccountFactory = await ethers.getContractFactory(
    "P256SmartAccountFactory"
  );
  const pubKey = [
    '0x8c36f69ffec57a20ce5ec75c94f4d1b46bdae751fd90df035d24f4fb54a963ba',
    '0x93632e668c503f14c6a3a267608326b7bb07f39c7533051d6c6274bc9eb6ab6c'
  ]
  const enclaveRegistry = "0x959DF35a4bDc25BA125615dfC84621D038A95FA8";
  const p256SmartAccountFactory = await P256SmartAccountFactory.deploy();
  await p256SmartAccountFactory.waitForDeployment();
  console.log(
    `Address of P256SmartAccountFactory is ${await p256SmartAccountFactory.getAddress()}`
  );

  const newP256Account = await p256SmartAccountFactory.getAccountAddress(
    pubKey,
    enclaveRegistry,
    0
  );
  console.log("New account: ", newP256Account);
  const tx = await p256SmartAccountFactory.createAccount(
    pubKey,
    enclaveRegistry,
    0
  );
  await tx.wait();
  console.log(tx);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

//entryPoint-0x5FbDB2315678afecb367f032d93F642f64180aa3
//enclaveRegistry-0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
//P256verifer--0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9
//Smart Account factory->0x95401dc811bb5740090279Ba06cfA8fcF6113778
//smartAccount-- 0xa0Dbb12cbb991f91C76E5D1af6e4349f8B8C08f5
//verifying paymaster -- 0x0165878A594ca255338adfa4d48449f69242Eb8F
// usdc-- 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

//PrivKey = {
//   privKey: Uint8Array(32) [
//     199, 159, 128, 212, 221,  71, 178, 234,
//     103,  78, 209, 175,  87, 254, 131,  80,
//       7,  92, 111, 101,  49, 230,  50,  51,
//     193, 179, 193,  34, 235,   1, 131,  33
//   ]
// }

// pubKey [
//   '0x8c36f69ffec57a20ce5ec75c94f4d1b46bdae751fd90df035d24f4fb54a963ba',
//   '0x93632e668c503f14c6a3a267608326b7bb07f39c7533051d6c6274bc9eb6ab6c'
// ]

// ArbSepolia --> factory--> 0x38dBcD03a211Be8D6A186A78076732093BAeDe3C
// smart wallets --> 0x05B24532A7523d788C095501A8D41361f551F236
