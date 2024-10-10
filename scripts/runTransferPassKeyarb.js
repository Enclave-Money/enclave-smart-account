// import { ethers } from "hardhat";
const { ethers } = require("hardhat");
const { p256 } = require("@noble/curves/p256");
const { default: axios } = require("axios");

const DefaultsForUserOp = {
  sender: ethers.ZeroAddress,
  nonce: 0,
  initCode: "0x",
  callData: "0x",
  callGasLimit: 0,
  verificationGasLimit: 3000000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 10000000, // should also cover calldata cost.
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
  const verificationGasLimit = 3000000;
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
  const EnclaveSmartAccount = await ethers.getContractFactory(
    "P256SmartAccount"
  );
  const enclaveSmartAccountAddress =
    "0x05B24532A7523d788C095501A8D41361f551F236";
  const enclaveSmartAccount = EnclaveSmartAccount.attach(
    enclaveSmartAccountAddress
  );

  // const addDepositTx = await enclaveSmartAccount.addDeposit({value: ethers.parseEther('2')});
  // await addDepositTx.wait();
  // console.log(addDepositTx);
  // const deposit = await enclaveSmartAccount.getDeposit();
  // console.log(ethers.formatEther(deposit));
  // return;
  const EntryPoint = await hre.ethers.getContractFactory("EntryPoint");
  const entryPoint = EntryPoint.attach(
    "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
  );
  const mockUsdc = (await ethers.getContractFactory("MockUSDC")).attach(
    "0x4fdaD6f3Ad2AaC8DA5E777d3D5DcB3Fb3aE59D5B"
  );

  const usdcEncodedData = mockUsdc.interface.encodeFunctionData("mint", [
    enclaveSmartAccountAddress,
    100 * 1e6,
  ]);
  const executeEncodedData = enclaveSmartAccount.interface.encodeFunctionData(
    "execute",
    ["0x4fdaD6f3Ad2AaC8DA5E777d3D5DcB3Fb3aE59D5B", 0, usdcEncodedData]
  );

  const { verificationGasLimit, maxFeePerGas, maxPriorityFeePerGas } =
    await getGasFee(ethers.provider);

  const op = {
    sender: enclaveSmartAccountAddress,
    nonce: null,
    initCode: null,
    callData: executeEncodedData,
    callGasLimit: null,
    verificationGasLimit,
    preVerificationGas: 1000000, // should also cover calldata cost.
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature: "0x",
  };

  const execEstimatedGas = await ethers.provider.estimateGas({
    from: await entryPoint.getAddress(),
    to: enclaveSmartAccountAddress,
    data: executeEncodedData,
  });

  op["callGasLimit"] = execEstimatedGas;
  const nonce = await enclaveSmartAccount.getNonce();
  console.log(hre.ethers.toBigInt(nonce));
  console.log(nonce);
  op["nonce"] = BigInt(nonce).toString();
  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
  const userOp = fillUserOpDefaults(op);
  const Paymaster = await hre.ethers.getContractFactory(
    "EnclaveVerifyingPaymaster"
  );
  const paymaster = Paymaster.attach(
    "0x930Af90BbaFC8996102B070fdeBC954331294c40"
  );
  // const depositTx = await paymaster.deposit({value: ethers.parseEther('2')});
  // await depositTx.wait();
  // const getDeposit = await paymaster.getDeposit();
  // console.log(getDeposit);
  // return;
  const VALID_UNTIL1 = Math.floor((Date.now() + 3600000) / 1000);
  const VALID_AFTER1 = Math.floor(Date.now() / 1000);
  const pmHash1 = await paymaster.getHash(userOp, VALID_UNTIL1, VALID_AFTER1);
  const signer = await ethers.provider.getSigner();
  const paymasterSignature1 = await signer.signMessage(
    ethers.getBytes(pmHash1)
  );
  console.log(paymasterSignature1);
  const encoded1 = abiCoder.encode(
    ["uint48", "uint48"],
    [VALID_UNTIL1, VALID_AFTER1]
  );
  console.log(
    abiCoder.encode(["uint48", "uint48"], [VALID_UNTIL1, VALID_AFTER1])
  );
  const paymasterAndData1 = hexConcat([
    await paymaster.getAddress(),
    encoded1,
    paymasterSignature1,
  ]);
  userOp.paymasterAndData = paymasterAndData1;

  const packedUserOp = packUserOp(userOp);
  const message = ethers.keccak256(
    abiCoder.encode(
      ["bytes32", "address", "uint256"],
      [ethers.keccak256(packedUserOp), await entryPoint.getAddress(), 421614]
    )
  );
  console.log(message);
  console.log(await entryPoint.getUserOpHash(userOp));
  console.log(userOp);
  const privKey = new Uint8Array([
    199, 159, 128, 212, 221, 71, 178, 234, 103, 78, 209, 175, 87, 254, 131, 80,
    7, 92, 111, 101, 49, 230, 50, 51, 193, 179, 193, 34, 235, 1, 131, 33,
  ]);
  const signature = p256.sign(message.substring(2), privKey);
  console.log(signature);
  // return;

  // const sign = await signer.signMessage(ethers.getBytes(message));
  userOp["signature"] = abiCoder.encode(
    ["uint256", "uint256"],
    [signature.r, signature.s]
  );

  const gasLimits = await axios.post(
    "https://bundler.biconomy.io/api/v2/421614/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44",
    {
      method: "eth_estimateUserOperationGas",
      params: [
        {
          sender: userOp.sender,
          nonce: userOp.nonce,
          initCode: userOp.initCode,
          callData: userOp.callData,
          paymasterAndData: userOp.paymasterAndData,
          signature: userOp.signature,
        },
        "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
      ],
      id: 1697033406,
      jsonrpc: "2.0",
    }
  );
  console.log(gasLimits.data);
  userOp.callGasLimit = gasLimits.data.result.callGasLimit.toString();
  userOp.verificationGasLimit =
    gasLimits.data.result.verificationGasLimit.toString();
  userOp.preVerificationGas =
    gasLimits.data.result.preVerificationGas.toString();
  const VALID_UNTIL = Math.floor((Date.now() + 3600000) / 1000);
  const VALID_AFTER = Math.floor(Date.now() / 1000);
  const pmHash = await paymaster.getHash(userOp, VALID_UNTIL, VALID_AFTER);
  const paymasterSignature = await signer.signMessage(ethers.getBytes(pmHash));
  console.log(paymasterSignature);
  const encoded = abiCoder.encode(
    ["uint48", "uint48"],
    [VALID_UNTIL, VALID_AFTER]
  );
  console.log(
    abiCoder.encode(["uint48", "uint48"], [VALID_UNTIL, VALID_AFTER])
  );
  const paymasterAndData = hexConcat([
    await paymaster.getAddress(),
    encoded,
    paymasterSignature,
  ]);
  userOp.paymasterAndData = paymasterAndData;

  const repackedUserOp = packUserOp(userOp);
  const newMessage = ethers.keccak256(
    abiCoder.encode(
      ["bytes32", "address", "uint256"],
      [ethers.keccak256(repackedUserOp), await entryPoint.getAddress(), 421614]
    )
  );
  const newsignature = p256.sign(newMessage.substring(2), privKey);
  console.log(newsignature);
  // return;

  // const sign = await signer.signMessage(ethers.getBytes(message));
  userOp["signature"] = abiCoder.encode(
    ["uint256", "uint256"],
    [newsignature.r, newsignature.s]
  );
  // userOp["signature"] = sign;
  const pubKey = new Uint8Array([
    2, 140, 54, 246, 159, 254, 197, 122, 32, 206, 94, 199, 92, 148, 244, 209,
    180, 107, 218, 231, 81, 253, 144, 223, 3, 93, 36, 244, 251, 84, 169, 99,
    186,
  ]);
  const publicKey = [
    "0x8c36f69ffec57a20ce5ec75c94f4d1b46bdae751fd90df035d24f4fb54a963ba",
    "0x93632e668c503f14c6a3a267608326b7bb07f39c7533051d6c6274bc9eb6ab6c",
  ];
  console.log(userOp);
  console.log(p256.verify(newsignature, newMessage.substring(2), pubKey));
  // return;
  const P256Verifier = await ethers.getContractFactory("P256Verifier");
  const p256Verifier = P256Verifier.attach(
    "0xf4Bd13DEA635266Ee82d8d5bE06a7df9E83C5B40"
  );
  console.log(
    await p256Verifier.ecdsa_verify(
      message,
      signature.r,
      signature.s,
      publicKey
    )
  );
  //  const tx2= await enclaveSmartAccount.validateUserOp(userOp,await entryPoint.getUserOpHash(userOp), 0)
  //   console.log(await tx2.wait());
  //   const transactionReceipt = await ethers.getDefaultProvider('http://127.0.0.1:8545').getTransactionReceipt(tx2.hash);
  //   console.log(transactionReceipt);
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
