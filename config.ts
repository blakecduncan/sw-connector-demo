import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { metaMask, safe } from "wagmi/connectors";
import { createSmartWalletConnector } from "./src/sdk/createSmartWalletConnector2";
import { arbitrumSepolia, base } from "@account-kit/infra";

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    createSmartWalletConnector(metaMask(), {
      apiKey: "",
    }),
    safe(),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});
