// import { ethers } from "hardhat";
const { ethers } = require("hardhat");

const DefaultsForUserOp = {
  sender: ethers.ZeroAddress,
  nonce: 0,
  initCode: "0x",
  callData: "0x",
  callGasLimit: 0,
  verificationGasLimit: 300000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 1000000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: "0x",
  signature: "0x",
};

function hexConcat(items) {
  let result = "0x";
  items.forEach((item) => {
    result += item.substring(2);
  });
  return result;
}

const getGasFee = async (provider) => {
  const verificationGasLimit = 200000;
  // const [fee, block] = await Promise.all([
  //   provider.send("eth_maxPriorityFeePerGas", []),
  //   provider.getBlock("latest"),
  // ]);
  const block = await provider.getBlock("latest");
  // // const tip = ethers.BigNumber.from(fee);
  // // const buffer = tip.div(100).mul(13);
  const maxPriorityFeePerGas = 0;
  console.log(block);
  console.log(block.baseFeePerGas);
  const maxFeePerGas = block.baseFeePerGas
    ? ethers.toBigInt("2") * block.baseFeePerGas +
      ethers.toBigInt(maxPriorityFeePerGas)
    : maxPriorityFeePerGas;

  return { maxFeePerGas, maxPriorityFeePerGas, verificationGasLimit };
};

//   function callDataCost(data) {
//     return ethers.utils
//       .arrayify(data)
//       .map((x) => (x === 0 ? 4 : 16))
//       .reduce((sum, x) => sum + x);
//   }

function packUserOp(userOp) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  // function to encode the useroperation for creating the hash to generate signature
  return abiCoder.encode(
    [
      "address",
      "uint256",
      "bytes32",
      "bytes32",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
    ],
    [
      userOp.sender,
      userOp.nonce,
      ethers.keccak256(userOp.initCode),
      ethers.keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      hre.ethers.keccak256(userOp.paymasterAndData),
    ]
  );
}

function fillUserOpDefaults(op, defaults = DefaultsForUserOp) {
  const partial = { ...op };
  // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
  // remove those so "merge" will succeed.
  for (const key in partial) {
    if (partial[key] == null) {
      delete partial[key];
    }
  }
  const filled = { ...defaults, ...partial };
  return filled;
}

async function main() {
  // const EnclaveRegistry = await ethers.getContractFactory("EnclaveResigtry");
  // const enclaveRegistryAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
  // const enclaveRegistry = EnclaveRegistry.attach(enclaveRegistryAddress);
  // const enclaveConverterAddress = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
  // const addConverterTx = await enclaveRegistry.updateRegistryAddress('converter', enclaveConverterAddress )
  // await addConverterTx.wait();
  // const converterAddress = await enclaveRegistry.getRegistryAddress('converter');
  // console.log(converterAddress);
  // const EnclaveSmartAccount = await ethers.getContractFactory(
  //   "SmartAccount"
  // );
  // const enclaveSmartAccountAddress =
  //   "0xD2a0f788c20c26eaec355B92Da0D99cBb547CaC2";
  // const enclaveSmartAccount = EnclaveSmartAccount.attach(
  //   enclaveSmartAccountAddress
  // );

  // // const addDepositTx = await enclaveSmartAccount.addDeposit({value: ethers.parseEther('2')});
  // // await addDepositTx.wait();
  // // console.log(addDepositTx);
  // // const deposit = await enclaveSmartAccount.getDeposit();
  // // console.log(ethers.formatEther(deposit));
  // // return;
  const EntryPoint = await hre.ethers.getContractFactory("EntryPoint");
  const entryPoint = EntryPoint.attach(
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
  );
  // const mockUsdc = (await ethers.getContractFactory("MockUSDC")).attach(
  //   "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"
  // );

  // const usdcEncodedData = mockUsdc.interface.encodeFunctionData("mint", [
  //   enclaveSmartAccountAddress,
  //   100 * 1e6,
  // ]);
  // const executeEncodedData = enclaveSmartAccount.interface.encodeFunctionData(
  //   "execute",
  //   ["0x610178dA211FEF7D417bC0e6FeD39F05609AD788", 0, usdcEncodedData]
  // );

  // const {verificationGasLimit, maxFeePerGas, maxPriorityFeePerGas} = await getGasFee(ethers.getDefaultProvider('http://127.0.0.1:8545'));

  // const op = {
  //   sender: enclaveSmartAccountAddress,
  //   nonce: null,
  //   initCode: null,
  //   callData: executeEncodedData,
  //   callGasLimit: null,
  //   verificationGasLimit,
  //   preVerificationGas: 1000000, // should also cover calldata cost.
  //   maxFeePerGas,
  //   maxPriorityFeePerGas,
  //   paymasterAndData: "0x",
  //   signature: "0x",
  // };

  // const execEstimatedGas = await ethers.getDefaultProvider('http://127.0.0.1:8545').estimateGas({
  //   from: await entryPoint.getAddress(),
  //   to: enclaveSmartAccountAddress,
  //   data: executeEncodedData
  // });

  // op["callGasLimit"] = execEstimatedGas;
  // const nonce = await enclaveSmartAccount.nonce(0);
  // console.log(hre.ethers.toBigInt(nonce));
  // console.log(nonce);
  // op["nonce"] = nonce;
  // const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
  // const userOp = fillUserOpDefaults(op);
  // const Paymaster = await hre.ethers.getContractFactory("EnclaveVerifyingPaymaster");
  // const paymaster = Paymaster.attach(
  //   "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6"
  // )
  // // const depositTx = await paymaster.deposit({value: ethers.parseEther('2')});
  // // await depositTx.wait();
  // // const getDeposit = await paymaster.getDeposit();
  // // console.log(getDeposit);
  // // return;
  // const VALID_UNTIL = Math.floor((Date.now() + 3600000) / 1000);
  // const VALID_AFTER = Math.floor(Date.now() / 1000);
  // const pmHash = await paymaster.getHash(userOp, VALID_UNTIL, VALID_AFTER);
  const signer = await ethers.provider.getSigner();
  const EnclaveSmartAccount = await ethers.getContractFactory(
    "SmartAccount"
  );
  const enclaveSmartAccountAddress =
    "0xe793e73E5380AefcE3b638677755964bd28cC0bC";
  const enclaveSmartAccount = EnclaveSmartAccount.attach(
    enclaveSmartAccountAddress
  );
  // const paymasterSignature = await signer.signMessage(
  //   ethers.getBytes(pmHash)
  // );
  // console.log(paymasterSignature);
  // const encoded = abiCoder.encode(
  //   ["uint48", "uint48"],
  //   [VALID_UNTIL, VALID_AFTER]
  // )
  // console.log(abiCoder.encode(
  //   ["uint48", "uint48"],
  //   [VALID_UNTIL, VALID_AFTER]
  // ));
  // const paymasterAndData = hexConcat([
  //   await paymaster.getAddress(),
  //   encoded,
  //   paymasterSignature,
  // ]);
  // userOp.paymasterAndData = paymasterAndData;

  // const packedUserOp = packUserOp(userOp);
  // const message = ethers.keccak256(
  //   abiCoder.encode(
  //     ["bytes32", "address", "uint256"],
  //     [ethers.keccak256(packedUserOp), await entryPoint.getAddress(), 31337]
  //   )
  // );
  // console.log(userOp);
  // return;
  const userOp = {
    sender: "0xe793e73E5380AefcE3b638677755964bd28cC0bC",
    nonce: "0x00",
    initCode: "0x",
    callData:
      "0xb61d27f6000000000000000000000000610178da211fef7d417bc0e6fed39f05609ad78800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000004440c10f19000000000000000000000000d2a0f788c20c26eaec355b92da0d99cbb547cac20000000000000000000000000000000000000000000000000000000005f5e10000000000000000000000000000000000000000000000000000000000",
    callGasLimit: "79476",
    verificationGasLimit: 200000,
    preVerificationGas: 1000000,
    maxFeePerGas: 249916756,
    maxPriorityFeePerGas: 0,
    paymasterAndData:
      "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe600000000000000000000000000000000000000000000000000000000664a2a4300000000000000000000000000000000000000000000000000000000664a1c33776cc8cae68500ee8c733f3c21b99d963979d5eda5075fa35889e0499f58134d478a7ccafef468e43d3952f90ed30a77fc2431a108297930eef7a9427c62cf9b1b",
    signature: "0x",
  };
  // const sign = await signer.signMessage(ethers.getBytes(message));

  userOp["signature"] =
    "0x5d2613792e97707c16a1ed3cce56e167900d5d457018eacf9df94b86d3c58935d85ea4c55aedb7b7deab8eb4548450b5afa334dc0d8c092a84134902388e49be05a22b308a1165541c0d59f8cdcfcd9af2d78127cb15febc5322526064a39f7600000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000000000000000000000000000000000000000002549960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d9763050000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000247b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000037222c226f726967696e223a22687474703a2f2f6c6f63616c686f73743a35313733222c2263726f73734f726967696e223a66616c73657d000000000000000000";
  // console.log(userOp);
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32", "uint256", "uint256", "bytes", "string", "string", "address"], userOp.signature);
  console.log(decoded);
  return;
  const userOpHash = "0x879f98c8527bca03e1683471c964917c65348f41b1e1ecea9518d7f2acdfa31e"
  const validationResult = await enclaveSmartAccount.validateUserOp(userOp, userOpHash, 0);
  console.log(validationResult);
  return;
  const tx1 = await entryPoint.handleOps([userOp], signer.address);
  // const tx1 = await entryPoint.simulateValidation(userOp);
  await tx1.wait();
  console.log(tx1);
  // const balanceOfSmartWallet2 = await eusd.balanceOf('0x31762ACE4365D2D4b39E7062CFA3a8A493E1955F');
  // console.log(balanceOfSmartWallet2);
  // const addDepositTx = await enclaveSmartAccount.addDeposit({value: ethers.parseEther('2')});
  // await addDepositTx.wait();
  // console.log(addDepositTx);
  // const deposit = await enclaveSmartAccount.getDeposit();
  // console.log(ethers.formatEther(deposit));

  // const MockUsdc = await ethers.getContractFactory("MockUSDC");
  // const mockUsdcAddress = '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853';
  // const mockUSDC = MockUsdc.attach(mockUsdcAddress);
  // const decimals = await mockUSDC.decimals();
  // console.log(decimals);
  // const transferTx = await mockUSDC.mint(enclaveSmartAccountAddress, ethers.parseEther('1000'));
  // await transferTx.wait();
  // const balance = await mockUSDC.balanceOf(enclaveSmartAccountAddress);
  // console.log(ethers.formatEther(balance));
  // const eusdAddress = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';
  // // const convertFunctionTx = await enclaveSmartAccount.convertStablecoins(mockUsdcAddress, eusdAddress);
  // // await convertFunctionTx.wait();
  // // console.log(convertFunctionTx);
  // const EnclaveConverter = await ethers.getContractFactory('EnclaveConverter');
  // const enclaveConverter = EnclaveConverter.attach(enclaveConverterAddress);
  // // const convertTx = await enclaveConverter.convert(enclaveSmartAccountAddress, mockUSDC, eusdAddress);
  // // await convertTx.wait();
  // // console.log(convertTx);
  // const convertBatchTx = await enclaveConverter.convertBatch([enclaveSmartAccountAddress], mockUSDC, eusdAddress);
  // await convertBatchTx.wait();
  // console.log(convertBatchTx);
  // console.log(await mockUSDC.balanceOf(enclaveSmartAccountAddress));
  // const EUSD = await ethers.getContractFactory("EUSD");
  // const eusd = await EUSD.attach(eusdAddress);
  // console.log(await eusd.balanceOf(enclaveSmartAccountAddress));

  // await enclaveRegistry.getRegistryAddress("converter");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// 0x130928a60A5F9c7Ffaf9aAB63d2fEA6B3b0Af3C7
// 0x0F3aF989D2FfabA8c8015E12Bb42a4480b24F7B7
// entryPoint 0x0E801D84Fa97b50751Dbf25036d067dCf18858bF
// verifying paymaster 0x2E2Ed0Cfd3AD2f1d34481277b3204d807Ca2F8c2
