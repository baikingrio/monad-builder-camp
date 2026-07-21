import type { ContractNetworksConfig } from '@safe-global/protocol-kit/dist/src/types/contracts'
import Safe from '@safe-global/protocol-kit'
import { PasskeySigner, SafeProvider } from '@safe-global/protocol-kit'
import { MONAD_TESTNET_CHAIN_ID } from './safe4337MonadConfig'
import { MONAD_SAFE_WEBAUTHN_SHARED_SIGNER } from './safePasskeyNetworks'

/** FCL P256 Verifier on Monad Testnet（与 Sepolia 同 canonical 地址，SDK 包未收录 10143）。 */
export const MONAD_FCL_P256_VERIFIER = '0xA86e0054C51E4894D88762a017ECc5E5235f5DBA' as const

/** Monad 文档列出的 Safe v1.4.1 部署 + Passkey 模块地址（Protocol Kit 的 contractNetworks）。 */
export const MONAD_SAFE_PASSKEY_CONTRACT_NETWORKS: ContractNetworksConfig = {
  [String(MONAD_TESTNET_CHAIN_ID)]: {
    safeSingletonAddress: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
    safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
    multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
    multiSendCallOnlyAddress: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
    fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
    signMessageLibAddress: '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
    createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
    simulateTxAccessorAddress: '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
    // Factory 在 canonical 地址无代码；与 Shared Signer 同址以便通过 SDK 部署检查，init 时不再调用 factory.getSigner。
    safeWebAuthnSignerFactoryAddress: MONAD_SAFE_WEBAUTHN_SHARED_SIGNER,
    safeWebAuthnSharedSignerAddress: MONAD_SAFE_WEBAUTHN_SHARED_SIGNER
  }
}

type Patched = {
  safeInit: typeof Safe.init
  providerInit: typeof SafeProvider.init
  passkeyInit: typeof PasskeySigner.init
}

function isMonadChainId(chainId: string | bigint | number): boolean {
  return String(chainId) === String(MONAD_TESTNET_CHAIN_ID)
}

/**
 * Safe4337Pack.init 不会把 customContracts 传给 Protocol Kit 的 Passkey 路径。
 * Monad 上补 contractNetworks，并在缺少 SignerFactory 部署时用 Shared Signer 完成 1/1 4337 推导。
 */
export async function withMonadPasskeySdkPatch<T>(run: () => Promise<T>): Promise<T> {
  const saved: Partial<Patched> = {
    safeInit: Safe.init.bind(Safe),
    providerInit: SafeProvider.init.bind(SafeProvider),
    passkeyInit: PasskeySigner.init.bind(PasskeySigner)
  }

  Safe.init = (config) =>
    saved.safeInit!({
      ...config,
      contractNetworks: config.contractNetworks ?? MONAD_SAFE_PASSKEY_CONTRACT_NETWORKS
    })

  SafeProvider.init = (provider, signer, safeVersion, contractNetworks, safeAddress, owners) =>
    saved.providerInit!(
      provider,
      signer,
      safeVersion,
      contractNetworks ?? MONAD_SAFE_PASSKEY_CONTRACT_NETWORKS,
      safeAddress,
      owners
    )

  PasskeySigner.init = async (
    passkey,
    safeWebAuthnSignerFactoryContract,
    safeWebAuthnSharedSignerContract,
    provider,
    safeAddress,
    owners,
    chainId
  ) => {
    // Monad 无 SignerFactory 部署；4337 1/1 流程只用 Shared Signer Owner，不能走 factory.getSigner。
    if (isMonadChainId(chainId)) {
      const signerAddress = await safeWebAuthnSharedSignerContract.getAddress()
      return new PasskeySigner(
        passkey,
        safeWebAuthnSignerFactoryContract,
        safeWebAuthnSharedSignerContract,
        provider,
        chainId,
        signerAddress
      )
    }
    return saved.passkeyInit!(
      passkey,
      safeWebAuthnSignerFactoryContract,
      safeWebAuthnSharedSignerContract,
      provider,
      safeAddress,
      owners,
      chainId
    )
  }

  try {
    return await run()
  } finally {
    Safe.init = saved.safeInit!
    SafeProvider.init = saved.providerInit!
    PasskeySigner.init = saved.passkeyInit!
  }
}
