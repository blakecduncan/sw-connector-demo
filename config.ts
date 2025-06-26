import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";
import {
  createSmartWalletConnector,
  createAccountKitConnector,
} from "./src/sdk";
import { alchemy, arbitrumSepolia, base } from "@account-kit/infra";
import { cookieStorage, createConfig as createAaConfig } from "@account-kit/core";

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    createSmartWalletConnector(metaMask(), {
      apiKey: "",
    }),
    createAccountKitConnector({
      config: createAaConfig({
        transport: alchemy({ apiKey: "" }),
        // Note: This quickstart is configured for Arbitrum Sepolia.
        chain: arbitrumSepolia,
        ssr: true, // more about ssr: https://www.alchemy.com/docs/wallets/react/ssr
        storage: cookieStorage, // more about persisting state with cookies: https://www.alchemy.com/docs/wallets/react/ssr#persisting-the-account-state
        enablePopupOauth: true, // must be set to "true" if you plan on using popup rather than redirect in the social login flow
        policyId: "",
        sessionConfig: {
          expirationTimeMs: 1000 * 60 * 60 * 24 * 30, // 30 days
        },
      }),
      smartAccountParams: { type: "ModularAccountV2" },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});
