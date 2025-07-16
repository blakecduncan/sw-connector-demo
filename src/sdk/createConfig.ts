import { createConfig as wagmiCreateConfig, type Config } from "wagmi";
import type { CreateConfigParameters } from "wagmi";

// Extended config type that includes Alchemy-specific properties
export interface AlchemyConfig extends Config {
  // Additional Alchemy-specific config properties can be added here
  _alchemy: {
    store?: Record<string, unknown>; // For any additional state we need to manage
    // Additional Alchemy-specific internal state
  };

  // Helper to get the underlying wagmi config
  getWagmiConfig(): Config;
}

// Extended parameters for Alchemy config
export type AlchemyCreateConfigParameters = CreateConfigParameters & {
  // Additional Alchemy-specific parameters can be added here
  // For example: alchemyOptions?: AlchemyOptions;
};

/**
 * Creates a config that extends wagmi's config with Alchemy-specific functionality
 * Returns a superset of wagmi's Config type as specified in the v5 design
 */
export function createConfig(
  parameters: AlchemyCreateConfigParameters
): AlchemyConfig {
  // Create the standard wagmi config
  const wagmiConfig = wagmiCreateConfig(parameters);

  // Create the extended Alchemy config
  const alchemyConfig: AlchemyConfig = {
    ...wagmiConfig,
    _alchemy: {
      store: {}, // Initialize any additional state management
    },
    getWagmiConfig(): Config {
      return wagmiConfig;
    },
  };

  return alchemyConfig;
}
