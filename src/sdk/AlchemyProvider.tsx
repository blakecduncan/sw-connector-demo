import React, { createContext, useContext, type ReactNode } from "react";
import type { AlchemyConfig } from "./createConfig";

// Context for the Alchemy configuration and additional state
interface AlchemyContextValue {
  config: AlchemyConfig;
  // Additional Alchemy-specific state can be added here
  // For example: authState, solanaConnection, etc.
}

const AlchemyContext = createContext<AlchemyContextValue | null>(null);

export interface AlchemyProviderProps {
  config: AlchemyConfig;
  children: ReactNode;
}

/**
 * Provider component that manages Alchemy-specific state outside of wagmi's store
 * This allows us to layer additional functionality while keeping wagmi as the core
 */
export function AlchemyProvider({ config, children }: AlchemyProviderProps) {
  const contextValue: AlchemyContextValue = {
    config,
    // Initialize any additional state management here
  };

  return (
    <AlchemyContext.Provider value={contextValue}>
      {children}
    </AlchemyContext.Provider>
  );
}

/**
 * Hook to access the Alchemy context
 */
export function useAlchemyContext(): AlchemyContextValue {
  const context = useContext(AlchemyContext);
  if (!context) {
    throw new Error("useAlchemyContext must be used within an AlchemyProvider");
  }
  return context;
}

/**
 * Hook to access the Alchemy config
 */
export function useAlchemyConfig(): AlchemyConfig {
  const { config } = useAlchemyContext();
  return config;
}
