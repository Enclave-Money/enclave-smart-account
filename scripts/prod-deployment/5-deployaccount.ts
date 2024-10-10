import { ethers } from "hardhat";

async function main() {
    const [signer] = await ethers.getSigners();
    const signerAddr = await signer.getAddress();
    console.log("Signer address:", await signer.getAddress());
    // Get the account factory contract instance
    const P256SmartAccountFactory = await ethers.getContractFactory("P256SmartAccountFactory");
    const p256SmartAccountFactory = P256SmartAccountFactory.attach("0x502674c8eF6A87A9C485df592033796A5ad71607");
    
    // console.log(`ENCLAVE_P256_SMART_ACCOUNT_FACTORY_ADDRESS=${p256SmartAccountFactoryAddress}`);

    // @ts-ignore
    const getDummyAddress = await p256SmartAccountFactory.getAccountAddress(
        ["0x440d8eb746e0a6b8da200ed3928ae2db1aa120950200911eca935a05c61ea99a","0x76daad039c44388a531369885b9f65c2d540d0b64726d77077801e1c21bc6c1c"], 
        "0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47", 
        0);
    console.log("Dummy Address: ", getDummyAddress);

    // @ts-ignore
    const res = await p256SmartAccountFactory.createAccount(
        ["0x440d8eb746e0a6b8da200ed3928ae2db1aa120950200911eca935a05c61ea99a","0x76daad039c44388a531369885b9f65c2d540d0b64726d77077801e1c21bc6c1c"], 
        "0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47", 
        0);

    console.log(res);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});