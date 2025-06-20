import { Account } from "./components/account";
import { WalletOptions } from "./components/wallet-options";
import { useAccount } from "wagmi";
import "./App.css";
import { SendCallsComponent } from "./components/send-calls";

function App() {
  const { isConnected } = useAccount();

  return (
    <div className="App">
      <h1>Wagmi Smart Wallets Demo</h1>
      {isConnected ? (
        <div>
          <Account />
          <SendCallsComponent />
        </div>
      ) : (
        <div>
          <h2>Connect your wallet</h2>
          <p>
            The MetaMask connector is wrapped with smart wallet functionality
          </p>
          <WalletOptions />
        </div>
      )}
    </div>
  );
}

export default App;
