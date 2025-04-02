import { ethers } from "hardhat";

async function main() {
	const wallet = new ethers.Wallet(
		process.env.TEST_KEY as string,
		ethers.provider
	);

	console.log("Using wallet", wallet.address);

	const tx = await wallet.sendTransaction({
		to: "0xe3838a038456f29428bb2FD097e0D52Cc2D03dCC",
		value: ethers.parseEther("0.2"),
	});

	const receipt = await tx.wait();

	console.log(receipt);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
