// Core infrastructure
export const REGISTRY_KEYS = {
  // Entry point contract for account abstraction
  ENTRY_POINT: "entryPoint",
  
  // Verification and validation
  P256_VERIFIER: "p256Verifier", // P256V
  P256_VALIDATOR: "P256Validator",
  MULTICHAIN_P256_VALIDATOR: "MultichainP256Validator",
  ECDSA_VALIDATOR: "ECDSAValidator",
  MULTICHAIN_ECDSA_VALIDATOR: "MultichainECDSAValidator",
  SESSION_KEY_VALIDATOR: "SessionKeyValidator", // SessionKeyAdapter

  // Paymasters
  PAYMASTER: "paymaster",
  ENCLAVE_VERIFYING_PAYMASTER: "enclaveVerifyingPaymaster",
  USDC: "usdc",
  USDT: "usdt",

  // Smart Balance System
  SMART_BALANCE_VAULT: "smartBalanceVault",
  SMART_BALANCE_CONVERSION_MANAGER: "smartBalanceConversionManager",
} as const;

// Type for type-safety when using keys
export type RegistryKey = typeof REGISTRY_KEYS[keyof typeof REGISTRY_KEYS];

// Helper function to validate registry key
export function isValidRegistryKey(key: string): key is RegistryKey {
  return Object.values(REGISTRY_KEYS).includes(key as RegistryKey);
}
