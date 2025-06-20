import { createSmartWalletClient } from "@account-kit/wallet-client";
import type { EIP1193Provider } from "viem";
import { alchemy, arbitrumSepolia } from "@account-kit/infra";
import { createWalletClient, custom } from "viem";
import { type SmartAccountSigner, WalletClientSigner } from "@aa-sdk/core";
// import { base } from "viem/chains";

export async function getSmartWalletClient({
  eip1193Provider,
  apiKey,
}: {
  eip1193Provider: EIP1193Provider;
  apiKey: string;
}) {
  const transport = alchemy({
    apiKey,
  });

  const [account] = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  const walletClient = createWalletClient({
    account,
    transport: custom(eip1193Provider),
    chain: arbitrumSepolia,
  });

  const signer: SmartAccountSigner = new WalletClientSigner(
    walletClient,
    "json-rpc"
  );

  const client = createSmartWalletClient({
    transport,
    chain: arbitrumSepolia,
    mode: "remote",
    signer,
  });
  return client;
}
