import { ethers } from "hardhat";

async function main() {
	const wallet = new ethers.Wallet(
		process.env.TEST_KEY as string,
		ethers.provider
	);

	const tx = await wallet.sendTransaction({
		to: "0x88B37912a1De8C31244941cD5739fDC1354980a3",
		value: ethers.parseEther("0.5"),
	});

	const receipt = await tx.wait();

	console.log(receipt);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
