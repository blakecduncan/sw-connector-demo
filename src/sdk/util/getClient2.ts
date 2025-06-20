import { createSmartWalletClient } from '@account-kit/wallet-client'
import {
  createWalletClient,
  custom,
  type Chain,
  type EIP1193Provider,
} from 'viem'
import { WalletClientSigner, type SmartAccountSigner } from '@aa-sdk/core'
import { arbitrumSepolia, alchemy } from '@account-kit/infra'

export async function getSmartWalletClient({
  eip1193Provider,
  apiKey,
  owner,
  chain = arbitrumSepolia,
  debug,
}: {
  eip1193Provider: EIP1193Provider
  apiKey: string
  owner: `0x${string}`
  chain?: Chain
  debug?: boolean
}) {
  const log = debug
    ? (...args: unknown[]) => console.debug('[SmartWalletClient]', ...args)
    : () => {}

  const transport = alchemy({ apiKey })
  const walletClient = createWalletClient({
    account: owner,
    transport: custom(eip1193Provider),
    chain,
  })

  const signer: SmartAccountSigner = new WalletClientSigner(walletClient, 'json-rpc')

  log('WalletClientSigner ready', signer)

  return createSmartWalletClient({
    transport,
    chain,
    mode: 'remote',
    signer,
  })
}