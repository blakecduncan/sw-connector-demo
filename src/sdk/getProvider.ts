import {
  getSmartAccountClient,
  watchSmartAccountClient,
  watchChain,
  watchSignerStatus,
} from "@account-kit/core";
import type {
  AlchemyAccountsConfig,
  GetSmartAccountClientParams,
  SupportedAccountTypes,
} from "@account-kit/core";

import { type EIP1193Provider, type Chain } from "viem";

// Define payload types per EIP-1193 event
interface ListenerMap {
  connect: (payload: { accounts: string[]; chainId: number }) => void;
  disconnect: () => void;
  accountsChanged: (accounts: string[]) => void;
  chainChanged: (chainId: number) => void;
}

type Eip1193Events = keyof ListenerMap;

/**
 * Returns an EIP-1193 provider backed by your SCA client.
 *
 * @param saParams  same params you'd pass to getSmartAccountClient()
 * @param config    your AlchemyAccountsConfig
 */
export function getProvider<TAccount extends SupportedAccountTypes>(
  saParams: GetSmartAccountClientParams<Chain, TAccount>,
  config: AlchemyAccountsConfig
): EIP1193Provider {
  /* ------------------------------------------------------------ */
  /* Minimal (typed) event emitter                                */
  /* ------------------------------------------------------------ */
  const listeners: { [K in Eip1193Events]: Set<ListenerMap[K]> } = {
    connect: new Set(),
    disconnect: new Set(),
    accountsChanged: new Set(),
    chainChanged: new Set(),
  };

  function on<K extends Eip1193Events>(event: K, fn: ListenerMap[K]) {
    listeners[event].add(fn);
  }
  function removeListener<K extends Eip1193Events>(
    event: K,
    fn: ListenerMap[K]
  ) {
    listeners[event].delete(fn);
  }

  // overloads for strongly-typed emit ------------------------------------------------
  function emit(event: "disconnect"): void;
  function emit(
    event: "connect",
    payload: Parameters<ListenerMap["connect"]>[0]
  ): void;
  function emit(
    event: "accountsChanged",
    payload: Parameters<ListenerMap["accountsChanged"]>[0]
  ): void;
  function emit(
    event: "chainChanged",
    payload: Parameters<ListenerMap["chainChanged"]>[0]
  ): void;
  function emit(event: Eip1193Events, payload?: unknown) {
    // Cast ensures the callback receives the right payload at runtime while
    // keeping compile-time type safety.
    (listeners[event] as Set<(arg?: unknown) => void>).forEach((fn) => {
      if (payload !== undefined) (fn as (arg: unknown) => void)(payload);
      else (fn as () => void)();
    });
  }

  /* ------------------------------------------------------------ */
  /* Wire up core state → EIP-1193 events                         */
  /* ------------------------------------------------------------ */
  watchSmartAccountClient(
    saParams,
    config
  )(({ address, client, isLoadingClient, error }) => {
    if (!isLoadingClient && client && address) {
      emit("connect", { accounts: [address], chainId: client.chain.id });
      emit("accountsChanged", [address]);
    }
    if (error) emit("disconnect");
  });

  watchChain(config)((chain) => emit("chainChanged", chain.id));

  watchSignerStatus(config)((status) => {
    if (status.isDisconnected) emit("disconnect");
  });

  /* ------------------------------------------------------------ */
  /* EIP-1193 request router                                      */
  /* ------------------------------------------------------------ */
  async function request({
    method,
    params: rpcParams,
  }: {
    method: string;
    params?: unknown[];
  }): Promise<unknown> {
    const { client, address, isLoadingClient } = getSmartAccountClient(
      saParams,
      config
    );
    if (isLoadingClient || !client || !address)
      throw new Error("Provider not connected");

    const chain = client.chain;
    const [p0, p1] = (rpcParams ?? []) as unknown[];

    switch (method) {
      case "eth_accounts":
        return [address];
      case "eth_chainId":
        return chain.id;
      case "eth_sendTransaction":
        return client.sendTransaction({
          ...(p0 as Record<string, unknown>),
          account: client.account,
          chain,
        } as Parameters<typeof client.sendTransaction>[0]);
      case "eth_sign":
      case "personal_sign": {
        const message = method === "eth_sign" ? p1 : p0;
        return client.signMessage({
          message: message as string,
          account: client.account,
        });
      }
      case "eth_signTypedData_v4": {
        const typedData = typeof p1 === "string" ? JSON.parse(p1) : p1;
        return client.signTypedData({ account: client.account, typedData });
      }
      default:
        return client.transport.request({ method, params: rpcParams ?? [] });
    }
  }

  /* ------------------------------------------------------------ */
  /* Assemble provider                                            */
  /* ------------------------------------------------------------ */
  return {
    request,
    on: on as unknown as EIP1193Provider["on"],
    removeListener:
      removeListener as unknown as EIP1193Provider["removeListener"],
  } as EIP1193Provider;
}
