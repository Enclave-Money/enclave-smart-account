import { Addressable } from "ethers";
import { ethers } from "hardhat";

async function deployMockUSDC() {
    const MockUSDC__factory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC__factory.deploy("USDM", "USD Mock");
    await mockUSDC.waitForDeployment();

    console.log("USD Mock deployed to: ", mockUSDC.target);
    return mockUSDC;
}

async function getMockUSDC(address: string | Addressable) {
    const MockUSDC__factory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = MockUSDC__factory.attach(address);
    return mockUSDC;
}

async function getSmartAccountFactory(address: string | Addressable) {
    const SmartAccountFactory__factory = await ethers.getContractFactory("SmartAccountFactory");
    const factory = SmartAccountFactory__factory.attach(address);
    return factory;
}

async function main() {
    // const userAddress = "0x51A20b575d36d50c910fEFCD2c7A0eBe41DE3802";
    const userAddress = "0x2BC5FF8A1a3D151571048EB02aaDb812f62B9cF6";
    const factoryAddress = "0xb1570eE5752940163aAd2F10aE3847ca0f674133";
    const entrypointAddress = "0xF522AA3eC4dA6237a9570021AB6187Ca111aa8b3";

    const paymasterAddress = "0x1d4146d4a7d315f96e17a4c0C7deB40D835d0941";

    // Wallet address: 0x2BC5FF8A1a3D151571048EB02aaDb812f62B9cF6
    // Private key: 0xbca7c599bc36420476586c2fae9f7b9e3ff53f8e8833243132c8bfb5c7af270e

    // const factory = await getSmartAccountFactory(factoryAddress);

    // @ts-ignore
    // const smartAccountAddress = await factory.getAccountAddress(userAddress, entrypointAddress, 0);
    // const smartAccountAddress = "0xd11b1d18392bEE5a5A95F7e4Abb4bEDfa1Eb6959";
    // @ts-ignore
    // const smartAccount = await factory.createAccount(userAddress, entrypointAddress, 0);
    // console.log("Smart account created: ", smartAccountAddress);

    // const mockUSDC = await deployMockUSDC();
    // const mockUSDC = await getMockUSDC("0x1CD873d27D145523C0cf2b71D42eE15ba7D91b7b"); // arb
    const mockUSDC = await getMockUSDC("0xf09156042741F67F8099D17eB22638F01F97974b"); // op

    // @ts-ignore
    await mockUSDC.mint(paymasterAddress, ethers.parseEther("1000000000000000000"));
    console.log("Minted 10000 USDM to user");

    // @ts-ignore
    const balance = await mockUSDC.balanceOf(paymasterAddress);
    console.log("Balance of user: ", balance);
}

main();

// Export the functions
export { deployMockUSDC, getMockUSDC };

