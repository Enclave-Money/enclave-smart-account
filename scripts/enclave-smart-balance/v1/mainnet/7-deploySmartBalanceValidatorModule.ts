import { getContractFactory } from "@nomicfoundation/hardhat-ethers/types";
import { getBytes, keccak256, toUtf8Bytes } from "ethers";
import { ethers } from "hardhat";


async function main() {
  console.log(keccak256(toUtf8Bytes("smartBalanceConvert(address)")).slice(0, 10));

  const [signer] = await ethers.getSigners();

  console.log("signer", signer.address);

  const registryFac = await ethers.getContractFactory("EnclaveRegistry");
  const registry = registryFac.attach("0xA8E8f8cBD889Fc74882AeDFDcf8323fD7423DB47")
  console.log("Registry: ", registry.target);


  const smartBalValFac = await ethers.getContractFactory("SmartBalanceKeyValidator");
  const smartBalVal = await smartBalValFac.deploy(registry.target);
  await smartBalVal.waitForDeployment();
  console.log("SmartBalanceKeyValidator: ", smartBalVal.target);

    //@ts-ignore
    let tx = await registry.updateRegistryAddress("smartBalanceConversionManager", signer.address);
    await tx.wait();

    //@ts-ignore
    tx = await registry.updateRegistryAddress("SessionKeyValidator", smartBalVal.target);
    await tx.wait();

    //@ts-ignore
    console.log("SessionKeyValidator 1: ", await registry.getRegistryAddress("SessionKeyValidator"));
    //@ts-ignore
    console.log("smartBalanceConversionManager 1: ", await registry.getRegistryAddress("smartBalanceConversionManager"));
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
