import type { CreateConnectorFn, Connector } from "wagmi";
import { createConnector } from "wagmi";
import {
  getAddress,
  UserRejectedRequestError,
  type Address,
  type EIP1193Provider,
} from "viem";
import { getSmartWalletClient } from "./util/getSmartwalletClient";

export interface CreateSmartWalletConnectorOptions {
  // Add specific config types here based on your needs
  [key: string]: unknown;
  config?: {
    apiKey?: string;
  };
}

export function createSmartWalletConnector(
  baseConnector: CreateConnectorFn | Connector,
  options: CreateSmartWalletConnectorOptions = {}
): CreateConnectorFn {
  // Acknowledge options to avoid unused warning
  void options;

  // let accountsChanged: Connector["onAccountsChanged"] | undefined;
  // let chainChanged: Connector["onChainChanged"] | undefined;
  // let disconnect: Connector["onDisconnect"] | undefined;

  type Properties = {
    connect(parameters?: {
      chainId?: number | undefined;
      instantOnboarding?: boolean | undefined;
      isReconnecting?: boolean | undefined;
    }): Promise<{
      accounts: readonly Address[];
      chainId: number;
    }>;
  };

  return createConnector<EIP1193Provider, Properties>((config) => {
    // If baseConnector is a CreateConnectorFn, call it to get the actual connector
    const connector =
      typeof baseConnector === "function"
        ? baseConnector(config)
        : baseConnector;

    let smartWalletClient: Awaited<
      ReturnType<typeof getSmartWalletClient>
    > | null = null;

    return {
      ...connector,
      id: `${connector.id}-smart-wallet`,
      name: `${connector.name} (Smart Wallet)`,
      type: `${connector.type}-smart-wallet` as const,

      async connect(params = {}) {
        const { chainId } = params;
        try {
          await connector.connect(params);
          await this.getProvider();
          const accounts = await this.getAccounts();

          // if (!accountsChanged) {
          //   accountsChanged = this.onAccountsChanged.bind(this);
          //   provider.on("accountsChanged", accountsChanged);
          // }
          // if (!chainChanged) {
          //   chainChanged = this.onChainChanged.bind(this);
          //   provider.on("chainChanged", chainChanged);
          // }
          // if (!disconnect) {
          //   disconnect = this.onDisconnect.bind(this);
          //   provider.on("disconnect", disconnect);
          // }

          // Switch to chain if provided
          let currentChainId = await connector.getChainId();
          if (chainId && currentChainId !== chainId) {
            const chain = await this.switchChain!({ chainId }).catch(
              (error) => {
                if (error.code === UserRejectedRequestError.code) throw error;
                return { id: currentChainId };
              }
            );
            currentChainId = chain?.id ?? currentChainId;
          }

          return { accounts, chainId: currentChainId };
        } catch (error) {
          if (
            /(user closed modal|accounts received is empty|user denied account|request rejected)/i.test(
              (error as Error).message
            )
          )
            throw new UserRejectedRequestError(error as Error);
          throw error;
        }
      },

      async disconnect() {
        connector.disconnect();
        smartWalletClient = null;
      },

      async getProvider(): Promise<EIP1193Provider> {
        // If we have a smart wallet client, return it
        // Note: Smart wallet client may not fully implement EIP1193Provider interface
        // but we'll cast it for compatibility
        if (smartWalletClient) {
          return smartWalletClient as unknown as EIP1193Provider;
        }
        const provider = (await connector.getProvider()) as EIP1193Provider;

        const accounts = (
          (await provider.request({
            method: "eth_accounts",
          })) as string[]
        ).map((x) => getAddress(x));

        if (accounts.length > 0) {
          smartWalletClient = await getSmartWalletClient({
            eip1193Provider: provider as EIP1193Provider,
            apiKey: options.config?.apiKey as string,
          });
          await smartWalletClient?.requestAccount();
          console.log({ chain: smartWalletClient?.chain });
          return smartWalletClient as unknown as EIP1193Provider;
        }

        // Otherwise return the base connector's provider
        return provider;
      },

      async getAccounts() {
        const provider = (await connector.getProvider()) as EIP1193Provider;
        const ownerAccounts = (
          (await provider.request({
            method: "eth_accounts",
          })) as string[]
        ).map((x) => getAddress(x));
        if (ownerAccounts.length > 0) {
          const accounts = await smartWalletClient?.listAccounts({
            signerAddress: ownerAccounts[0],
          });
          console.log(accounts);
        }
        const account = await smartWalletClient?.requestAccount();
        console.log(account);
        return account?.address ? [account?.address] : [];
      },

      // Forward all other methods to the base connector
      async getChainId() {
        const chainId = await connector.getChainId();
        return chainId;
      },
      isAuthorized: connector.isAuthorized,
      switchChain: connector.switchChain,
      setup: connector.setup,
      onAccountsChanged: connector.onAccountsChanged,
      onChainChanged: connector.onChainChanged,
      onConnect: connector.onConnect,
      onDisconnect: (error) => {
        smartWalletClient = null;
        connector.onDisconnect?.(error);
      },
      onMessage: connector.onMessage,
    };
  });
}
