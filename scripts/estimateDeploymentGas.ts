import { ethers } from "hardhat";
import { ContractFactory, Provider, Interface, JsonRpcProvider } from "ethers";

// Define networks directly in this file
interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  enabled: boolean;
}

const networks: NetworkConfig[] = [
  // {
  //   name: "mainnet",
  //   rpcUrl: "https://eth.llamarpc.com",
  //   chainId: 1,
  //   enabled: true
  // },
  // {
  //   name: "unichain",
  //   rpcUrl: "https://rpc.therpc.io/unichain",
  //   chainId: 130,
  //   enabled: true
  // },
  // {
  //   name: "blast",
  //   rpcUrl: "https://rpc.blast.io",
  //   chainId: 81457,
  //   enabled: true
  // },
  // {
  //   name: "linea",
  //   rpcUrl: "https://1rpc.io/linea",
  //   chainId: 59144,
  //   enabled: true
  // },
  // {
  //   name: "scroll",
  //   rpcUrl: "https://1rpc.io/scroll",
  //   chainId: 534353,
  //   enabled: true
  // },
  // {
  //   name: "mode",
  //   rpcUrl: "https://1rpc.io/mode",
  //   chainId: 34443,
  //   enabled: true
  // },
  // {
  //   name: "ink",
  //   rpcUrl: "https://rpc-qnd.inkonchain.com",
  //   chainId: 57073,
  //   enabled: true
  // },
  {
    name: "worldchain",
    rpcUrl: "https://worldchain-mainnet.g.alchemy.com/public",
    chainId: 480,
    enabled: true
  },
  // {
  //   name: "abstract",
  //   rpcUrl: "https://api.mainnet.abs.xyz",
  //   chainId: 2741,
  //   enabled: true
  // }
];

// Filter enabled networks
const enabledNetworks = networks.filter(network => network.enabled);

async function estimateGasForContract(
  contractName: string,
  factory: ContractFactory,
  provider: Provider,
  args: any[] = [],
  gasPrice: bigint
): Promise<bigint> {
  try {
    const deployTx = await factory.getDeployTransaction(...args);
    
    // Use 5M gas limit as that's the maximum allowed by most nodes
    const tx = {
      ...deployTx,
      gasLimit: 5_000_000n
    };
    
    const gasEstimate = await provider.estimateGas(tx);
    // Calculate ETH cost
    const costInWei = gasEstimate * gasPrice;
    const costInEth = ethers.formatEther(costInWei);
    console.log(`${contractName}: ${gasEstimate.toString()} gas (≈ ${costInEth} ETH)`);
    return gasEstimate;
  } catch (error: any) {
    if (typeof error === 'object' && error?.info?.error?.message?.includes('gas required exceeds')) {
      console.error(`${contractName}: Contract deployment might require more gas than the block gas limit`);
    } else {
      console.error(`Error estimating gas for ${contractName}:`, error);
    }
    return BigInt(0);
  }
}

async function estimateGasForFunctionCall(
  contractAddress: string,
  contractInterface: Interface,
  functionName: string, 
  provider: Provider,
  args: any[] = [],
  gasPrice: bigint,
  logOutput: boolean = true,
  logPrefix: string = ''
): Promise<bigint> {
  try {
    // Create calldata for the function
    const data = contractInterface.encodeFunctionData(functionName, args);
    
    // Create a transaction object with 5M gas limit
    const tx = {
      to: contractAddress,
      data,
      gasLimit: 5_000_000n
    };
    
    // Estimate gas
    const gasEstimate = await provider.estimateGas(tx);
    
    // Calculate ETH cost
    const costInWei = gasEstimate * gasPrice;
    const costInEth = ethers.formatEther(costInWei);
    
    if (logOutput) {
      console.log(`${logPrefix}${functionName}: ${gasEstimate.toString()} gas (≈ ${costInEth} ETH)`);
    }
    return gasEstimate;
  } catch (error: any) {
    if (typeof error === 'object' && error?.info?.error?.message?.includes('gas required exceeds')) {
      console.error(`${functionName}: Function call might require more gas than the block gas limit`);
    } else {
      console.error(`Error estimating gas for function ${functionName}:`, error);
    }
    return BigInt(0);
  }
}

// Get current gas price
async function getCurrentGasPrice(provider: Provider): Promise<bigint> {
  try {
    const feeData = await provider.getFeeData();
    return feeData.gasPrice || BigInt(0);
  } catch (error) {
    console.error("Error getting gas price:", error);
    return BigInt(0);
  }
}

async function estimateGasForNetwork(network: NetworkConfig) {
  console.log(`\nEstimating gas for ${network.name}...`);
  
  // Create provider for the network using the RPC URL defined in this file
  const provider = new JsonRpcProvider(network.rpcUrl);
  
  // Get current gas price
  const gasPrice = await getCurrentGasPrice(provider);
  const gasPriceGwei = ethers.formatUnits(gasPrice, 'gwei');
  console.log(`Current gas price: ${gasPriceGwei} Gwei`);
  
  // Define contracts and their constructor args
  const contractArgs: Record<string, any[]> = {
    "EnclaveRegistryV0": ["0x0000000000000000000000000000000000000001"],
    "P256Validator": ["0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000001"],
    "SmartBalanceKeyValidator": ["0x0000000000000000000000000000000000000001"],
    "LimitOrderSessionValidator": ["0x0000000000000000000000000000000000000001"],
    "MultichainP256Validator": ["0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000001"],
    "EnclaveModuleManager": ["0x0000000000000000000000000000000000000001"]
  };

  // Deploy contracts
  const contracts = [
    { name: "SmartAccountFactoryV1", factory: await ethers.getContractFactory("SmartAccountFactoryV1") },
    { name: "P256SmartAccountFactoryV1", factory: await ethers.getContractFactory("P256SmartAccountFactoryV1") },
    { name: "EnclaveRegistryV0", factory: await ethers.getContractFactory("EnclaveRegistryV0") },
    { name: "P256Validator", factory: await ethers.getContractFactory("P256Validator") },
    { name: "SmartAccountECDSAValidator", factory: await ethers.getContractFactory("SmartAccountECDSAValidator") },
    { name: "SmartBalanceKeyValidator", factory: await ethers.getContractFactory("SmartBalanceKeyValidator") },
    { name: "SimpleSessionKeyValidator", factory: await ethers.getContractFactory("SimpleSessionKeyValidator") },
    { name: "MultichainP256Validator", factory: await ethers.getContractFactory("MultichainP256Validator") },
    { name: "LimitOrderSessionValidator", factory: await ethers.getContractFactory("LimitOrderSessionValidator") },
    { name: "EnclaveModuleManager", factory: await ethers.getContractFactory("EnclaveModuleManager") }
  ];

  // Results for deployment and function calls
  const deployResults: { [key: string]: bigint } = {};
  const functionCallResults: { [key: string]: bigint } = {};

  // First step: Estimate gas for contract deployments
  console.log(`\nEstimating deployment gas costs on ${network.name}...`);
  for (const contract of contracts) {
    const args = contractArgs[contract.name] || [];
    const gasEstimate = await estimateGasForContract(contract.name, contract.factory, provider, args, gasPrice);
    deployResults[contract.name] = gasEstimate;
  }

  // Second step: Estimate gas for function calls just once and multiply by 5
  console.log(`\nEstimating function call gas costs on ${network.name}...`);
  
  // Set dummy addresses for deployed contracts
  const dummyContractAddresses = {
    "EnclaveRegistryV0": "0x0000000000000000000000000000000000010001",
    "EnclaveModuleManager": "0x0000000000000000000000000000000000010002"
  };
  
  // Get contract interfaces for function calls
  const registryInterface = (await ethers.getContractFactory("EnclaveRegistryV0")).interface;
  const moduleManagerInterface = (await ethers.getContractFactory("EnclaveModuleManager")).interface;
  
  // Estimate gas for a single EnclaveRegistry.updateRegistryAddress
  const contractName = "SAMPLE_CONTRACT";
  const contractAddress = "0x0000000000000000000000000000000000001000";
  const nameBytes = ethers.encodeBytes32String(contractName);
  
  const registryGasEstimate = await estimateGasForFunctionCall(
    dummyContractAddresses["EnclaveRegistryV0"],
    registryInterface,
    "updateRegistryAddress",
    provider,
    [nameBytes, contractAddress],
    gasPrice,
    true,
    "EnclaveRegistryV0."
  );
  
  // Calculate the cost of 5 calls
  const registryGasTotal = registryGasEstimate * 5n;
  const registryTotalCostInEth = ethers.formatEther(registryGasTotal * gasPrice);
  
  functionCallResults["EnclaveRegistryV0.updateRegistryAddress (single call)"] = registryGasEstimate;
  functionCallResults["EnclaveRegistryV0.updateRegistryAddress (5 calls total)"] = registryGasTotal;
  
  console.log(`EnclaveRegistryV0.updateRegistryAddress (5 calls total): ${registryGasTotal.toString()} gas (≈ ${registryTotalCostInEth} ETH)`);
  
  // Estimate gas for a single EnclaveModuleManager.enableModule
  const moduleAddress = "0x0000000000000000000000000000000000020001";
  
  const moduleGasEstimate = await estimateGasForFunctionCall(
    dummyContractAddresses["EnclaveModuleManager"],
    moduleManagerInterface,
    "enableModule",
    provider,
    [moduleAddress],
    gasPrice,
    true,
    "EnclaveModuleManager."
  );
  
  // Calculate the cost of 5 calls
  const moduleGasTotal = moduleGasEstimate * 5n;
  const moduleTotalCostInEth = ethers.formatEther(moduleGasTotal * gasPrice);
  
  functionCallResults["EnclaveModuleManager.enableModule (single call)"] = moduleGasEstimate;
  functionCallResults["EnclaveModuleManager.enableModule (5 calls total)"] = moduleGasTotal;
  
  console.log(`EnclaveModuleManager.enableModule (5 calls total): ${moduleGasTotal.toString()} gas (≈ ${moduleTotalCostInEth} ETH)`);

  return {
    deployments: deployResults,
    functionCalls: functionCallResults,
    gasPrice
  };
}

async function main() {
  console.log("Starting gas estimation for all networks...");
  
  const allResults: { 
    [network: string]: { 
      deployments: { [contract: string]: bigint },
      functionCalls: { [functionCall: string]: bigint },
      gasPrice?: bigint,
      estimatedCostInEth?: { [key: string]: string }
    } 
  } = {};

  for (const network of enabledNetworks) {
    try {
      // Get gas estimates
      const results = await estimateGasForNetwork(network);
      
      // Calculate estimated costs in ETH
      const estimatedCostInEth: { [key: string]: string } = {};
      const gasPrice = results.gasPrice || BigInt(0);
      
      if (gasPrice > 0) {
        // Calculate deployment costs
        for (const [contract, gas] of Object.entries(results.deployments)) {
          const costInWei = gas * gasPrice;
          const costInEth = ethers.formatEther(costInWei);
          estimatedCostInEth[`deploy_${contract}`] = costInEth;
        }
        
        // Calculate function call costs
        for (const [functionCall, gas] of Object.entries(results.functionCalls)) {
          const costInWei = gas * gasPrice;
          const costInEth = ethers.formatEther(costInWei);
          estimatedCostInEth[functionCall] = costInEth;
        }
      }
      
      allResults[network.name] = {
        ...results,
        estimatedCostInEth
      };
    } catch (error) {
      console.error(`Error estimating gas for ${network.name}:`, error);
    }
  }

  // Print summary
  console.log("\nGas Estimation Summary:");
  console.log("======================");
  
  for (const [network, results] of Object.entries(allResults)) {
    console.log(`\n${network.toUpperCase()}:`);
    if (results.gasPrice) {
      console.log(`Gas Price: ${ethers.formatUnits(results.gasPrice, 'gwei')} Gwei`);
    }
    
    console.log("\nContract Deployments:");
    console.log("--------------------");
    
    // Calculate total deployment gas and cost
    let totalDeploymentGas = BigInt(0);
    let totalDeploymentCostEth = 0;
    
    for (const [contract, gas] of Object.entries(results.deployments)) {
      let output = `${contract}: ${gas.toString()} gas`;
      if (results.estimatedCostInEth?.[`deploy_${contract}`]) {
        output += ` (≈ ${results.estimatedCostInEth[`deploy_${contract}`]} ETH)`;
      }
      console.log(output);
      
      // Add to totals
      totalDeploymentGas += gas;
      if (results.estimatedCostInEth?.[`deploy_${contract}`]) {
        totalDeploymentCostEth += parseFloat(results.estimatedCostInEth[`deploy_${contract}`]);
      }
    }
    
    // Print deployment totals
    console.log("\nTotal Deployment: " + totalDeploymentGas.toString() + " gas" + 
      (totalDeploymentCostEth > 0 ? ` (≈ ${totalDeploymentCostEth.toFixed(18)} ETH)` : ""));
    
    console.log("\nFunction Calls:");
    console.log("--------------");
    
    // Calculate total function call gas and cost
    // We'll only include the "5 calls total" entries to avoid double counting
    let totalFunctionCallGas = BigInt(0);
    let totalFunctionCallCostEth = 0;
    
    for (const [functionCall, gas] of Object.entries(results.functionCalls)) {
      let output = `${functionCall}: ${gas.toString()} gas`;
      if (results.estimatedCostInEth?.[functionCall]) {
        output += ` (≈ ${results.estimatedCostInEth[functionCall]} ETH)`;
      }
      console.log(output);
      
      // Add to totals only for the "5 calls total" entries
      if (functionCall.includes("5 calls total")) {
        totalFunctionCallGas += gas;
        if (results.estimatedCostInEth?.[functionCall]) {
          totalFunctionCallCostEth += parseFloat(results.estimatedCostInEth[functionCall]);
        }
      }
    }
    
    // Print function call totals
    console.log("\nTotal Function Calls: " + totalFunctionCallGas.toString() + " gas" + 
      (totalFunctionCallCostEth > 0 ? ` (≈ ${totalFunctionCallCostEth.toFixed(18)} ETH)` : ""));
      
    // Print grand total
    const grandTotalGas = totalDeploymentGas + totalFunctionCallGas;
    const grandTotalCostEth = totalDeploymentCostEth + totalFunctionCallCostEth;
    
    console.log("\nGRAND TOTAL: " + grandTotalGas.toString() + " gas" + 
      (grandTotalCostEth > 0 ? ` (≈ ${grandTotalCostEth.toFixed(18)} ETH)` : ""));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 