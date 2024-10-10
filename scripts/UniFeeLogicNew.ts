import { ethers } from "hardhat";


async function main() {
    const verifyingSigner = await ethers.provider.getSigner();

    const UniswapFeeLogicFactory = await ethers.getContractFactory("EnclaveFeeLogicUniswap", verifyingSigner);
    // const uniswapFeeLogic = await UniswapFeeLogicFactory.deploy(
    //     "0x4200000000000000000000000000000000000006",
    //     "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    //     1,
    //     20
    // );
    // await uniswapFeeLogic.waitForDeployment();
    const uniswapFeeLogic = UniswapFeeLogicFactory.attach("0x9C7732875d1d788D4Ebf9492D34043B51e186204");

    console.log("UniswapFeeLogic deployed to:", uniswapFeeLogic.target);

    //@ts-ignore
    const res1 = await uniswapFeeLogic.updateMarkup(
        105, // USDC
    );
    
    //@ts-ignore
    const res2 = await uniswapFeeLogic.updateMarkupDenominator(
        100, // USDC
    );

    //@ts-ignore
    console.log("markup: ", await uniswapFeeLogic.markup(), await uniswapFeeLogic.markupDenominator());

    //@ts-ignore
    const res3 = await uniswapFeeLogic.findOptimalPool(
        "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC
    );

    console.log("OPT POOL: ", res3);

    // Call calculateFee
    //@ts-ignore
    const res4 = await uniswapFeeLogic.calculateFee(
        "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC
        10000000000000000n
    );

    console.log("result: ", res4);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});