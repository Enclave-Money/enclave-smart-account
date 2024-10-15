import { Addressable } from "ethers";
import { ethers } from "hardhat";

async function main() {
    const userAddress = "0x51A20b575d36d50c910fEFCD2c7A0eBe41DE3802";
    const factoryAddress = "0xb1570eE5752940163aAd2F10aE3847ca0f674133";
    const entrypointAddress = "0xF522AA3eC4dA6237a9570021AB6187Ca111aa8b3";

    // const factory = await getSmartAccountFactory(factoryAddress);

    // // @ts-ignore
    // const smartAccountAddress = await factory.getAccountAddress(userAddress, entrypointAddress, 0);
    const smartAccountAddress = "0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959";
    // const smartAccountAddress = "0x900179e7cD1156337B204C5ff09589370Aeca7c4";

    const smartAccountContractFactory = await ethers.getContractFactory("SmartAccount");
    // @ts-ignore
    const smartAccountContract = smartAccountContractFactory.attach(smartAccountAddress);

    // @ts-ignore
    const entrypoint = await smartAccountContract.entryPoint();
    console.log("Entrypoint: ", entrypoint);

    // @ts-ignore
    const owner = await smartAccountContract.owner();
    console.log("Owner: ", owner);
}

main();

