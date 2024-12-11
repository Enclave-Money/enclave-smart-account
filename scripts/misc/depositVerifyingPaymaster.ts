import { ethers } from "hardhat";

async function main() {
  // Amount to deposit (in ETH)
  const depositAmount = ethers.parseEther("0.0008"); // Adjust this value as needed

  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log(deployer.address);

  // Get the paymaster contract address
  // const paymasterAddress = '0xE6467Bf0f5cB46faA45E54B3DfE83abC2A2615e1'; // ARB
  // const paymasterAddress = '0xd3C02681577e7f87f091736eF1817328ed980B42'; // OP
  // const paymasterAddress = "0x959DF35a4bDc25BA125615dfC84621D038A95FA8";  // BASE // Replace with actual address
  const paymasterAddress = "0xcC6ac1dc190500D12b34509cE24498A96CfFf4B9";
  // const paymasterAddress = "0x224e0779e0Ef924f0c0954fe2C886CF58E1a293e" // AVAX

  // // Create contract instance
  // const paymasterFac = await  ethers.getContractFactory("EnclaveVerifyingPaymaster");
  const paymasterFac = await  ethers.getContractFactory("EnclaveSolverPaymasterV2D");
  const paymaster = paymasterFac.attach(paymasterAddress);

  // Deposit funds
  //@ts-ignore
  const tx = await paymaster.deposit({value: depositAmount});
  await tx.wait();

  // console.log(`Successfully deposited ${ethers.formatEther(depositAmount)} ETH to paymaster`);

  // Get and log the new deposit balance
  //@ts-ignore
  const balance = await paymaster.getDeposit();
  console.log(`New deposit balance: ${ethers.formatEther(balance)} ETH`);

  // @ts-ignore
  // const tx = await paymaster.withdrawTo(deployer.address, balance / BigInt(2));
  // await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});
