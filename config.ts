import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";
import {
  createSmartWalletConnector,
  createAccountKitConnector,
} from "./src/sdk";
import {
  base as baseChain,
  arbitrumSepolia as arbitrumSepoliaChain,
} from "wagmi/chains";
import { alchemy, arbitrumSepolia } from "@account-kit/infra";
import {
  cookieStorage,
  createConfig as createAaConfig,
} from "@account-kit/core";

export const config = createConfig({
  chains: [mainnet, sepolia, arbitrumSepoliaChain, baseChain],
  connectors: [
    createSmartWalletConnector(metaMask(), {
      apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
    }),
    createAccountKitConnector({
      config: createAaConfig({
        transport: alchemy({ apiKey: import.meta.env.VITE_ALCHEMY_API_KEY }),
        chain: arbitrumSepolia,
        ssr: false,
        storage: cookieStorage,
        enablePopupOauth: true,
        policyId: import.meta.env.VITE_POLICY_ID,
      }),
      smartAccountParams: { type: "ModularAccountV2" },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [baseChain.id]: http(),
    [arbitrumSepoliaChain.id]: http(),
  },
});
