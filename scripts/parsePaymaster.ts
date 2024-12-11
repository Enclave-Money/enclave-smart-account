import { ethers } from "hardhat";

async function main() {
    const paymasterAddress = "0xd3C02681577e7f87f091736eF1817328ed980B42"; // Replace with your EnclaveVerifyingPaymaster address
    const paymasterAndData0 = "0xd3C02681577e7f87f091736eF1817328ed980B42000000000000000000000000000000000000000000000000000000006742e439000000000000000000000000000000000000000000000000000000006742d6299e9ca830067757d60b4de3fb665b593aa4c5949b473ba749cd5e460a49ee43b773e62ab49295e2f6fc6d336b9b6a7609db484ed183f2cd0bbde0bf84e412d51c1c"; // Replace with your paymasterAndData value
    const paymasterAndData = "0xd3C02681577e7f87f091736eF1817328ed980B42000000000000000000000000000000000000000000000000000000006742e3ac000000000000000000000000000000000000000000000000000000006742d59c6f6f3a50564e98dc8e3f8edba5850db4d574d24723c8d2e06bacad8e081365a921ce190498dcfdb48aeb22ecbf204b18715b37bbd4cf906d0f169104bd6f207e1b";
    // Get the contract factory for EnclaveVerifyingPaymaster
    const PaymasterFactory = await ethers.getContractFactory("EnclaveVerifyingPaymaster");
    const paymasterContract = PaymasterFactory.attach(paymasterAddress);

    try {
        // Parse the paymasterAndData
        //@ts-ignore
        const parsedData = await paymasterContract.parsePaymasterAndData(paymasterAndData);
        console.log("Parsed Paymaster and Data:", parsedData);
    } catch (error) {
        console.error("Error parsing paymasterAndData:", error);
    }
}

main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
}); 