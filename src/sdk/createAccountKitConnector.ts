import {
  getSmartAccountClient,
  reconnect,
  disconnect as aaDisconnect,
  getSignerStatus,
  getChain as getAaChain,
  setChain as setAaChain,
  type AlchemyAccountsConfig,
  type GetSmartAccountClientParams,
  type SupportedAccountTypes,
  getSigner,
  watchSignerStatus,
  type SignerStatus,
  getAccount,
  watchAccount,
  type GetAccountResult,
} from "@account-kit/core";
import { createConnector, type CreateConnectorFn } from "wagmi";
import { type Chain, type EIP1193Provider } from "viem";

import { getProvider } from "./getProvider";

export interface CreateAccountKitConnectorOptions<
  TAccount extends SupportedAccountTypes
> {
  /** The Alchemy Accounts config used to manage authentication and state. */
  config: AlchemyAccountsConfig;
  /** Parameters forwarded to `getSmartAccountClient` and `getProvider`. */
  smartAccountParams: GetSmartAccountClientParams<Chain, TAccount>;
}

export function createAccountKitConnector<
  TAccount extends SupportedAccountTypes
>(options: CreateAccountKitConnectorOptions<TAccount>): CreateConnectorFn {
  return createConnector<EIP1193Provider>((wagmiConfig) => {
    let provider: EIP1193Provider | null = null;
    let detachListeners: (() => void) | null = null;

    const attachListeners = (prov: EIP1193Provider) => {
      const onAccountsChanged = (accounts: string[]) => {
        wagmiConfig.emitter.emit("change", {
          accounts: accounts as readonly `0x${string}`[],
        });
      };
      const onChainChanged = (hexChainId: string) => {
        const chainId = parseInt(hexChainId, 16);
        wagmiConfig.emitter.emit("change", { chainId });
      };
      const onDisconnect = () => {
        wagmiConfig.emitter.emit("disconnect");
      };

      prov.on?.("accountsChanged", onAccountsChanged);
      prov.on?.("chainChanged", onChainChanged);
      prov.on?.("disconnect", onDisconnect);

      return () => {
        prov.removeListener?.("accountsChanged", onAccountsChanged);
        prov.removeListener?.("chainChanged", onChainChanged);
        prov.removeListener?.("disconnect", onDisconnect);
      };
    };

    const ensureProvider = (): EIP1193Provider => {
      if (!provider) {
        provider = getProvider(options.smartAccountParams, options.config);
        detachListeners = attachListeners(provider);
      }
      return provider;
    };

    return {
      id: "account-kit",
      name: "AccountKit",
      type: "account-kit" as const,

      async connect({ chainId } = {}) {
        await reconnect(options.config);

        // ensure user is authenticated via OAuth if not already connected
        const signerStatus = await waitForSignerReady(options.config);
        const signer = getSigner(options.config);

        if (
          signer &&
          !signerStatus.isConnected &&
          !signerStatus.isAuthenticating
        ) {
          // attempt OAuth authentication, fall back silently if method unavailable
          try {
            if (typeof signer.authenticate === "function") {
              // Ensure popup flow prepared
              await signer.preparePopupOauth();
              await signer.authenticate({
                type: "oauth",
                authProviderId: "google",
                mode: "popup",
              });
            }
          } catch (error) {
            console.error("Failed to authenticate", error);
          }
        }

        if (chainId && getAaChain(options.config).id !== chainId) {
          const chain = wagmiConfig.chains.find((c) => c.id === chainId);
          if (chain) await setAaChain(options.config, chain);
        }

        // Wait for account to be ready
        const accountResult = await waitForAccountReady(
          options.smartAccountParams,
          options.config
        );


        const accounts: readonly `0x${string}`[] =
          accountResult.status === "READY" && accountResult.account?.address
            ? [accountResult.account.address as `0x${string}`]
            : [];

        const connectedId = getAaChain(options.config).id;

        return { accounts, chainId: connectedId };
      },

      async disconnect() {
        detachListeners?.();
        detachListeners = null;
        provider = null;
        await aaDisconnect(options.config);
      },

      async getProvider() {
        return ensureProvider();
      },

      async getAccounts() {
        const { address } = getSmartAccountClient(
          options.smartAccountParams,
          options.config
        );
        return address ? [address] : [];
      },

      async getChainId() {
        return getAaChain(options.config).id;
      },

      async isAuthorized() {
        const status = await waitForSignerReady(options.config);
        return status.isConnected;
      },

      async switchChain({ chainId }) {
        const chain = wagmiConfig.chains.find((c) => c.id === chainId);
        if (!chain) throw new Error("Chain not found");
        await setAaChain(options.config, chain);
        return chain;
      },

      onAccountsChanged: (accounts: string[]) => {
        wagmiConfig.emitter.emit("change", {
          accounts: accounts as readonly `0x${string}`[],
        });
      },

      onChainChanged: (chainId: string | number) => {
        const id =
          typeof chainId === "string" ? parseInt(chainId, 16) : chainId;
        wagmiConfig.emitter.emit("change", { chainId: id });
      },

      onDisconnect: () => {
        wagmiConfig.emitter.emit("disconnect");
      },
    };
  });
}

function waitForSignerReady(
  config: AlchemyAccountsConfig
): Promise<SignerStatus> {
  const status = getSignerStatus(config);
  // already ready (either connected or disconnected)
  if (!status.isInitializing && !status.isAuthenticating) {
    return Promise.resolve(status);
  }
  return new Promise((resolve) => {
    const unsubscribe = watchSignerStatus(config)((st) => {
      if (!st.isInitializing && !st.isAuthenticating) {
        unsubscribe();
        resolve(st);
      }
    });
  });
}

function waitForAccountReady<TAccount extends SupportedAccountTypes>(
  smartAccountParams: GetSmartAccountClientParams<Chain, TAccount>,
  config: AlchemyAccountsConfig
): Promise<GetAccountResult<TAccount>> {
  const account = getAccount(smartAccountParams, config);

  // already ready
  if (account.status === "READY" && account.account) {
    return Promise.resolve(account);
  }

  // already failed
  if (account.status === "ERROR") {
    return Promise.resolve(account);
  }

  return new Promise((resolve) => {
    const unsubscribe = watchAccount(
      smartAccountParams.type,
      config
    )((accountState) => {
      if (accountState.status === "READY" || accountState.status === "ERROR") {
        unsubscribe();
        resolve(accountState);
      }
    });
  });
}
