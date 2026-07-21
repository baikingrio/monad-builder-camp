import { extractPasskeyData, type PasskeyArgType } from '@safe-global/protocol-kit'
import { Safe4337Pack } from '@safe-global/relay-kit'
import type { SafePasskeyReadiness } from './safePasskeyConfig'
import { withMonadPasskeySdkPatch, MONAD_FCL_P256_VERIFIER } from './safePasskeyMonadSdkPatch'
import { safePasskeyFeeEstimator } from './safePasskeyFeeEstimator'

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
  const { network } = ready
  const signer =
    network.id === 'monad'
      ? { ...passkey, customVerifierAddress: passkey.customVerifierAddress ?? MONAD_FCL_P256_VERIFIER }
      : passkey
  const paymasterOptions = network.sepoliaPaymasterAddress
    ? {
        isSponsored: true as const,
        paymasterAddress: network.sepoliaPaymasterAddress,
        paymasterUrl: ready.paymasterUrl
      }
    : {
        isSponsored: true as const,
        paymasterUrl: ready.paymasterUrl
      }

  const init = () =>
    Safe4337Pack.init({
      provider: network.rpcUrl,
      signer,
      bundlerUrl: ready.bundlerUrl,
      paymasterOptions,
      safeModulesVersion: network.id === 'monad' ? '0.2.0' : undefined,
      customContracts: network.customContracts,
      options: { owners: [], threshold: 1 }
    })

  if (network.id === 'monad') {
    return withMonadPasskeySdkPatch(init)
  }
  return init()
}

export async function getSafeAccountInfo(passkey: PasskeyArgType, config: SafePasskeyReadiness) {
  const safe4337Pack = await createSafe4337Pack(passkey, config)
  return {
    address: await safe4337Pack.protocolKit.getAddress(),
    isDeployed: await safe4337Pack.protocolKit.isSafeDeployed()
  }
}

export async function submitPracticeUserOperation(
  passkey: PasskeyArgType,
  safeAddress: string,
  config: SafePasskeyReadiness
) {
  const ready = requireReady(config)
  const safe4337Pack = await createSafe4337Pack(passkey, config)
  const data = ready.network.buildPracticeCalldata(safeAddress)
  const operation = await safe4337Pack.createTransaction({
    transactions: [{ to: ready.network.practiceTargetAddress, data, value: '0' }],
    options: { feeEstimator: safePasskeyFeeEstimator }
  })
  const signedOperation = await safe4337Pack.signSafeOperation(operation)
  return safe4337Pack.executeTransaction({ executable: signedOperation })
}

/** @deprecated 使用 submitPracticeUserOperation；保留别名供文档/旧引用。 */
export const mintPracticeNft = submitPracticeUserOperation
