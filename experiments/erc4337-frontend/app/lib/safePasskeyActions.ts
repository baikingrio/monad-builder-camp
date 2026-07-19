import { extractPasskeyData, type PasskeyArgType } from '@safe-global/protocol-kit'
import { Safe4337Pack } from '@safe-global/relay-kit'
import { encodeFunctionData } from 'viem'
import {
  SAFE_PASSKEY_NFT_ADDRESS,
  SEPOLIA_PAYMASTER_ADDRESS,
  SEPOLIA_RPC_URL,
  type SafePasskeyReadiness
} from './safePasskeyConfig'

function requireReady(config: SafePasskeyReadiness): Extract<SafePasskeyReadiness, { ready: true }> {
  if (!config.ready) throw new Error(config.message)
  return config
}

export async function createBrowserPasskey(): Promise<PasskeyArgType> {
  const credential = await navigator.credentials.create({
    publicKey: {
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Safe Passkey Practice' },
      user: {
        displayName: 'Safe Owner',
        id: crypto.getRandomValues(new Uint8Array(32)),
        name: 'Safe Owner'
      },
      timeout: 60_000,
      attestation: 'none'
    }
  })

  if (!credential) throw new Error('未返回 Passkey 凭证。')
  return extractPasskeyData(credential)
}

async function createSafe4337Pack(passkey: PasskeyArgType, config: SafePasskeyReadiness) {
  const ready = requireReady(config)
  return Safe4337Pack.init({
    provider: SEPOLIA_RPC_URL,
    signer: passkey,
    bundlerUrl: ready.bundlerUrl,
    paymasterOptions: {
      isSponsored: true,
      paymasterAddress: SEPOLIA_PAYMASTER_ADDRESS,
      paymasterUrl: ready.paymasterUrl
    },
    options: { owners: [], threshold: 1 }
  })
}

export async function getSafeAccountInfo(passkey: PasskeyArgType, config: SafePasskeyReadiness) {
  const safe4337Pack = await createSafe4337Pack(passkey, config)
  return {
    address: await safe4337Pack.protocolKit.getAddress(),
    isDeployed: await safe4337Pack.protocolKit.isSafeDeployed()
  }
}

export async function mintPracticeNft(passkey: PasskeyArgType, safeAddress: string, config: SafePasskeyReadiness) {
  const safe4337Pack = await createSafe4337Pack(passkey, config)
  const data = encodeFunctionData({
    abi: [{
      type: 'function',
      name: 'safeMint',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }],
      outputs: []
    }],
    functionName: 'safeMint',
    args: [safeAddress as `0x${string}`, randomUint256()]
  })
  const operation = await safe4337Pack.createTransaction({
    transactions: [{ to: SAFE_PASSKEY_NFT_ADDRESS, data, value: '0' }]
  })
  const signedOperation = await safe4337Pack.signSafeOperation(operation)
  return safe4337Pack.executeTransaction({ executable: signedOperation })
}

function randomUint256(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytes.reduce((result, value) => (result << 8n) | BigInt(value), 0n)
}
