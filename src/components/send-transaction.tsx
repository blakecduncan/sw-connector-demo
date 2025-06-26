import * as React from "react";
import {
  type BaseError,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";

export function SendTransaction() {
  const {
    data: hash,
    error,
    isPending,
    sendTransaction,
  } = useSendTransaction();

  // Hard-coded transaction parameters
  const to = "0x773fC6d79B9E96A695356300e2Ee482DAB3685b8"; // TODO: replace with desired address
  const value = "0.00"; // ETH amount to send

  function handleSend() {
    sendTransaction({ to, value: parseEther(value) });
  }

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return (
    <>
      <h2 className="text-xl font-bold mb-4">
        eth_sendTransaction: Send Transaction
      </h2>
      {/* Single button triggering the hard-coded transaction */}
      <button disabled={isPending} onClick={handleSend}>
        {isPending ? "Confirming..." : "Send"}
      </button>
      {hash && <div>Transaction Hash: {hash}</div>}
      {isConfirming && <div>Waiting for confirmation...</div>}
      {isConfirmed && <div>Transaction confirmed.</div>}
      {error && (
        <div>Error: {(error as BaseError).shortMessage || error.message}</div>
      )}
    </>
  );
}
