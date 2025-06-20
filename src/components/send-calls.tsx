import { useState } from "react";
import { useAccount, useSendCalls, useCallsStatus } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";

export function SendCallsComponent() {
  const { address } = useAccount();
  const { sendCallsAsync, data: callId } = useSendCalls();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: callStatusData } = useCallsStatus({
    id: callId?.id as string,
    query: {
      enabled: !!callId?.id,
      refetchInterval: (data) =>
        data.state.data?.status === "success" ? false : 1000,
    },
  });

  const sendEmptyTransaction = async () => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create an empty transaction - sends 0 ETH to self with no data
      const calls = [
        {
          to: address,
          value: BigInt(0),
          data: "0x" as `0x${string}`,
        },
      ];

      const result = await sendCallsAsync({
        chainId: arbitrumSepolia.id,
        calls,
        // capabilities: {
        //   paymasterService: {
        //     policyId: ''
        //   },
        // },
      });
      console.log("Empty transaction sent:", result);
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Send Empty Transaction</h2>

      <div className="space-y-4">
        <button
          onClick={sendEmptyTransaction}
          disabled={!address || isLoading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? "Sending..." : "Send Empty Transaction"}
        </button>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {callId && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Call ID:</strong> {callId.id}
            </p>

            {callStatusData && (
              <div className="p-3 bg-gray-100 rounded">
                <p className="text-sm">
                  <strong>Status:</strong> {callStatusData.status}
                </p>
                {callStatusData.receipts &&
                  callStatusData.receipts.length > 0 && (
                    <p className="text-sm">
                      <strong>Transaction Hash:</strong>{" "}
                      <span className="font-mono text-xs">
                        {callStatusData.receipts[0].transactionHash}
                      </span>
                    </p>
                  )}
              </div>
            )}
          </div>
        )}

        {!address && (
          <p className="text-sm text-gray-500">
            Please connect your wallet to send transactions
          </p>
        )}
      </div>
    </div>
  );
}
