import {ethers} from "hardhat";

async function main() {
    const ERC20 = await ethers.getContractFactory("MockUSDC");
    // const erc20 = await ERC20.deploy("ERC20", "ERC20");
    // await erc20.waitForDeployment();
    // const erc20Address = await erc20.getAddress();
    // console.log(`Address of erc20 is ${ erc20Address }`)

    const erc20 = ERC20.attach("0x68B1D87F95878fE05B998F19b66F4baba5De1aed");

    const scw_address = "0xeC5A9a343CbD923806Ad1A408496E7410018e637";

   //@ts-ignore
    // const res = await erc20.mint(scw_address, ethers.parseEther("1000000000"));
    
    // console.log("Txn Res: ", res);

    //@ts-ignore
    console.log("Balance of contract: ", await erc20.balanceOf(scw_address));

    // Give me code to get an erc20 contract at a specified address
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});