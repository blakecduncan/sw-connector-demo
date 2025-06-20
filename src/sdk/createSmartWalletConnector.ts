import { createConnector, type Connector, type CreateConnectorFn } from "wagmi";
import {
  getAddress,
  UserRejectedRequestError,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { getSmartWalletClient } from "./util/getSmartWalletClient";

/* ------------------------------------------------------------------ */
/* Types & constants                                                  */
/* ------------------------------------------------------------------ */

export interface CreateSmartWalletConnectorOptions {
  /** Alchemy/Infura key used by the AA backend */
  apiKey: string;
  /** Optional chain override. Defaults to `arbitrumSepolia`. */
  chain?: Chain;
  /** Enable verbose console output in development. */
  debug?: boolean;
  /**
   * Whether to simulate programme‑matic disconnect like
   * Wagmi's `injected` connector. Defaults to `true`.
   */
  shimDisconnect?: boolean;
}

const STORAGE_KEY = "wagmi.smartwallet.shimDisconnect";

/* ------------------------------------------------------------------ */
/* Implementation                                                     */
/* ------------------------------------------------------------------ */

export function createSmartWalletConnector(
  base: CreateConnectorFn | Connector,
  options: CreateSmartWalletConnectorOptions
): CreateConnectorFn {
  if (!options?.apiKey)
    throw new Error("createSmartWalletConnector: `apiKey` missing");

  return createConnector<EIP1193Provider>((wagmiConfig) => {
    const baseConnector = typeof base === "function" ? base(wagmiConfig) : base;

    /* -------------------------------------------------------------- */
    /* Internal state                                                 */
    /* -------------------------------------------------------------- */
    let smartWalletClient: Awaited<
      ReturnType<typeof getSmartWalletClient>
    > | null = null;

    let detachListeners: (() => void) | null = null;

    const log = options.debug
      ? (...args: unknown[]) => console.debug("[SmartWalletConnector]", ...args)
      : () => {};

    /* -------------------------------------------------------------- */
    /* Helpers                                                        */
    /* -------------------------------------------------------------- */
    const attachListeners = (provider: EIP1193Provider) => {
      const onAccountsChanged = (accounts: Address[]) => {
        wagmiConfig.emitter.emit("connect", { accounts, chainId: 0 });
      };
      const onChainChanged = (chainId: Hex) => {
        const numChainId = parseInt(chainId, 16);
        wagmiConfig.emitter.emit("change", { chainId: numChainId });
      };
      const onDisconnect = () => {
        // Handle disconnect
      };

      provider.on?.("accountsChanged", onAccountsChanged);
      provider.on?.("chainChanged", onChainChanged);
      provider.on?.("disconnect", onDisconnect);

      return () => {
        provider.removeListener?.("accountsChanged", onAccountsChanged);
        provider.removeListener?.("chainChanged", onChainChanged);
        provider.removeListener?.("disconnect", onDisconnect);
      };
    };

    const ensureProvider = async (): Promise<EIP1193Provider> => {
      if (smartWalletClient)
        return smartWalletClient as unknown as EIP1193Provider;

      const raw = (await baseConnector.getProvider()) as EIP1193Provider;
      const [owner] = (await raw.request({
        method: "eth_accounts",
      })) as string[];
      if (!owner) return raw; // not yet authorised – fall back

      smartWalletClient = await getSmartWalletClient({
        eip1193Provider: raw,
        apiKey: options.apiKey,
        chain: options.chain,
        owner: getAddress(owner),
        debug: options.debug,
      });
      log("AA client initialised", smartWalletClient);
      return smartWalletClient as unknown as EIP1193Provider;
    };

    /* -------------------------------------------------------------- */
    /* Public connector API                                           */
    /* -------------------------------------------------------------- */
    return {
      ...baseConnector,
      id: `${baseConnector.id}-smart-wallet`,
      name: `${baseConnector.name} (Smart Wallet)`,
      type: `${baseConnector.type}-smart-wallet` as const,

      async connect({ chainId, ...rest } = {}) {
        // short‑circuit if user hit "disconnect" previously
        if (options.shimDisconnect !== false)
          localStorage.removeItem(STORAGE_KEY);

        // delegate to base connector (triggers the wallet pop‑up)
        await baseConnector.connect({
          chainId,
          ...rest,
        });

        // make sure AA provider is ready (no extra pop‑up)
        await ensureProvider();
        const account = await smartWalletClient?.requestAccount();
        const accounts = account ? [account.address] : [];

        // handle optional chain switch
        let active = await baseConnector.getChainId();
        if (chainId && active !== chainId) {
          try {
            await this.switchChain?.({ chainId });
            active = chainId;
          } catch (err: unknown) {
            if (
              err &&
              typeof err === "object" &&
              "code" in err &&
              err.code === UserRejectedRequestError.code
            )
              throw err;
          }
        }

        return { accounts, chainId: active };
      },

      async disconnect() {
        if (options.shimDisconnect !== false)
          localStorage.setItem(STORAGE_KEY, "true");

        detachListeners?.();
        detachListeners = null;
        smartWalletClient = null;
        await baseConnector.disconnect?.();
      },

      async getProvider(): Promise<EIP1193Provider> {
        const provider = await ensureProvider();
        // attach listeners once
        if (!detachListeners) detachListeners = attachListeners(provider);
        return provider;
      },

      async getAccounts() {
        const provider = await ensureProvider();
        if (provider.request === undefined) return [];
        const [account] = (await provider.request({
          method: "eth_accounts",
        })) as string[];
        return account ? [getAddress(account)] : [];
      },

      async getChainId() {
        return baseConnector.getChainId();
      },

      async isAuthorized() {
        if (options.shimDisconnect !== false) {
          if (localStorage.getItem(STORAGE_KEY) === "true") return false;
        }
        try {
          const provider = await ensureProvider();
          const accounts = (await provider.request({
            method: "eth_accounts",
          })) as string[];
          return accounts.length > 0;
        } catch {
          return false;
        }
      },
    };
  });
}
