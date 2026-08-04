// x402 protocol-compliant payment signers for the MPP32 SDK.
//
// This is a port/adaptation of mcp-server/src/x402-signers.ts — the reference
// correct implementation. Two schemes are implemented end-to-end, both following
// the official `exact` scheme from https://x402.org and Coinbase's reference impl:
//
//   • SVM (Solana): build a 3-instruction Solana VersionedTransaction
//       (SetComputeUnitLimit, SetComputeUnitPrice, SPL-Token TransferChecked
//       between Associated Token Accounts), set the facilitator-advertised
//       fee payer, partially sign with the payer's Ed25519 keypair, and
//       base64-encode the wire transaction. The fee-payer signature slot is
//       left empty — the facilitator fills it during /settle.
//   • EVM (Base / Base-Sepolia / Ethereum): sign an EIP-3009
//       `transferWithAuthorization` typed-data message with the payer's
//       secp256k1 key using viem.
//
// In both cases the outer envelope is
//   { x402Version, scheme: "exact", network, payload: <scheme payload> }
// base64-encoded into the `X-Payment` HTTP header. This is exactly the
// base64 partially-signed transaction envelope backend/src/lib/x402.ts's
// verifyX402Envelope / settleX402Payment expect as `paymentPayload`.
//
// The heavy Solana / viem crypto deps are loaded lazily via dynamic import so
// that (a) free-tier / read-only SDK usage (listServices, unpaid analyze) never
// needs them installed, and (b) if a payment IS attempted without them present,
// we fail LOUDLY with an actionable `npm install` message instead of leaking a
// broken envelope. The specifiers are assigned to a variable before `import()`
// so the SDK type-checks without the optional packages installed.

// ── Public types ─────────────────────────────────────────────────────────────

export interface X402PaymentRequirements {
  scheme: string
  network: string
  maxAmountRequired: string
  resource: string
  description?: string
  mimeType?: string
  payTo: string
  maxTimeoutSeconds?: number
  asset: string
  outputSchema?: unknown
  extra?: {
    feePayer?: string
    name?: string
    version?: string
    decimals?: number
    [k: string]: unknown
  }
}

export interface X402PaymentEnvelope {
  x402Version: number
  scheme: string
  network: string
  payload: unknown
}

export interface SignX402Args {
  paymentRequiredHeader: string
  solanaKey?: string
  evmKey?: string
  solanaRpcUrl?: string
  // Optional override: "solana" | "base" | "ethereum" | "evm" | full CAIP-2.
  preferredNetwork?: string
}

export interface SignX402Result {
  xPaymentHeader: string
  network: string
  scheme: string
  protocolUsed: 'x402-svm' | 'x402-evm'
}

// ── Lazy dependency loaders (loud, actionable failure) ───────────────────────

const SVM_INSTALL_HINT =
  'npm install @solana/kit @solana-program/token @solana-program/compute-budget @scure/base'
const EVM_INSTALL_HINT = 'npm install viem'

async function loadSvmDeps(): Promise<any> {
  // Assign specifiers to variables so the bundler/tsc does not eagerly require
  // these optional packages to be installed for type-checking.
  const kitPkg = '@solana/kit'
  const tokenPkg = '@solana-program/token'
  const computeBudgetPkg = '@solana-program/compute-budget'
  const scureBasePkg = '@scure/base'

  const [kit, tokenProgram, computeBudgetProgram, scureBase] = await Promise.all([
    import(kitPkg),
    import(tokenPkg),
    import(computeBudgetPkg),
    import(scureBasePkg),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `MPP32: Could not load Solana signing libraries (${msg}). ` +
        `x402 USDC-on-Solana payments require these packages — install them:\n  ${SVM_INSTALL_HINT}\n` +
        `They also require Node 20.18 or newer (they use Node-20 WebCrypto Ed25519 APIs).`,
    )
  })

  return {
    address: kit.address,
    createKeyPairSignerFromBytes: kit.createKeyPairSignerFromBytes,
    createKeyPairSignerFromPrivateKeyBytes: kit.createKeyPairSignerFromPrivateKeyBytes,
    createSolanaRpc: kit.createSolanaRpc,
    createTransactionMessage: kit.createTransactionMessage,
    setTransactionMessageFeePayer: kit.setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash: kit.setTransactionMessageLifetimeUsingBlockhash,
    appendTransactionMessageInstructions: kit.appendTransactionMessageInstructions,
    partiallySignTransactionMessageWithSigners: kit.partiallySignTransactionMessageWithSigners,
    getBase64EncodedWireTransaction: kit.getBase64EncodedWireTransaction,
    pipe: kit.pipe,
    getTransferCheckedInstruction: tokenProgram.getTransferCheckedInstruction,
    findAssociatedTokenPda: tokenProgram.findAssociatedTokenPda,
    TOKEN_PROGRAM_ADDRESS: tokenProgram.TOKEN_PROGRAM_ADDRESS,
    getSetComputeUnitLimitInstruction: computeBudgetProgram.getSetComputeUnitLimitInstruction,
    getSetComputeUnitPriceInstruction: computeBudgetProgram.getSetComputeUnitPriceInstruction,
    base58: scureBase.base58,
  }
}

async function loadEvmDeps(): Promise<any> {
  try {
    const viemPkg = 'viem/accounts'
    const viemAccounts = await import(viemPkg)
    return { privateKeyToAccount: viemAccounts.privateKeyToAccount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `MPP32: Could not load EVM signing libraries (${msg}). ` +
        `x402 USDC-on-Base/Ethereum payments require viem — install it:\n  ${EVM_INSTALL_HINT}`,
    )
  }
}

// ── Network classification ───────────────────────────────────────────────────

export function isSvmNetwork(network: string): boolean {
  return network.startsWith('solana') || network === 'solana-mainnet' || network === 'solana-devnet'
}

export function isEvmNetwork(network: string): boolean {
  if (network.startsWith('eip155:')) return true
  return ['base', 'base-sepolia', 'ethereum', 'ethereum-sepolia'].includes(network)
}

interface EvmChainSpec {
  chainId: number
  name: string
  rpcUrl: string
}

function chainSpecFor(network: string): EvmChainSpec {
  if (network === 'base' || network === 'eip155:8453') {
    return { chainId: 8453, name: 'Base', rpcUrl: 'https://mainnet.base.org' }
  }
  if (network === 'base-sepolia' || network === 'eip155:84532') {
    return { chainId: 84532, name: 'Base Sepolia', rpcUrl: 'https://sepolia.base.org' }
  }
  if (network === 'ethereum' || network === 'eip155:1') {
    return { chainId: 1, name: 'Ethereum', rpcUrl: 'https://eth.llamarpc.com' }
  }
  throw new Error(
    `MPP32: Unsupported EVM network "${network}". x402 EVM payments support: base, base-sepolia, ethereum.`,
  )
}

// ── Key decoding (base58 / JSON byte array / hex) ────────────────────────────

function decodeSolanaSecret(raw: string, deps: any): Uint8Array {
  if (raw.startsWith('[')) {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) throw new Error('MPP32: Solana secret JSON array malformed')
    return new Uint8Array(arr)
  }
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    return new Uint8Array(Buffer.from(raw, 'hex'))
  }
  return deps.base58.decode(raw)
}

async function buildSolanaSigner(rawKey: string, deps: any): Promise<any> {
  const bytes = decodeSolanaSecret(rawKey, deps)
  if (bytes.length === 32) {
    // 32-byte seed — kit derives the public key via WebCrypto Ed25519.
    return await deps.createKeyPairSignerFromPrivateKeyBytes(bytes)
  }
  if (bytes.length === 64) {
    // 64-byte expanded key (seed || publicKey) — kit's standard path.
    return await deps.createKeyPairSignerFromBytes(bytes)
  }
  throw new Error(
    `MPP32: Solana private key must be a 32-byte seed or a 64-byte expanded key; got ${bytes.length} bytes.`,
  )
}

// ── SVM signer ────────────────────────────────────────────────────────────────

const DEFAULT_SOLANA_RPC = 'https://api.mainnet-beta.solana.com'

export async function signX402PaymentSvm(
  requirements: X402PaymentRequirements,
  rawKey: string,
  rpcUrlOverride?: string,
  echoedVersion: number = 1,
  computeUnitLimitOverride?: number,
): Promise<string> {
  if (requirements.scheme !== 'exact') {
    throw new Error(`MPP32: SVM x402 scheme "${requirements.scheme}" not implemented; only "exact" is supported.`)
  }
  if (!requirements.extra?.feePayer) {
    throw new Error(
      'MPP32: SVM x402 challenge is missing extra.feePayer. The facilitator must advertise a fee-payer address ' +
        'per the x402 spec. If this is a third-party service, ask them to fix their challenge.',
    )
  }

  const decimals = requirements.extra?.decimals ?? 6
  const amount = BigInt(requirements.maxAmountRequired)
  if (amount <= 0n) throw new Error(`MPP32: Invalid maxAmountRequired: ${requirements.maxAmountRequired}`)

  const deps = await loadSvmDeps()

  const signer = await buildSolanaSigner(rawKey, deps)
  const payerAddress = signer.address
  const mintAddress = deps.address(requirements.asset)
  const recipientAddress = deps.address(requirements.payTo)
  const feePayerAddress = deps.address(requirements.extra.feePayer)

  // Self-payment guard: an SPL TransferChecked where source ATA == destination
  // ATA is a no-op the Solana runtime rejects; catch it here with a clear message.
  if (String(payerAddress) === String(recipientAddress)) {
    throw new Error(
      `MPP32: Refusing to sign an x402 payment to yourself: the wallet derived from your Solana key ` +
        `(${String(payerAddress)}) is also the payment recipient (payTo). Use a different payer wallet.`,
    )
  }

  const [sourceAtaTuple, destinationAtaTuple] = await Promise.all([
    deps.findAssociatedTokenPda({
      owner: payerAddress,
      mint: mintAddress,
      tokenProgram: deps.TOKEN_PROGRAM_ADDRESS,
    }),
    deps.findAssociatedTokenPda({
      owner: recipientAddress,
      mint: mintAddress,
      tokenProgram: deps.TOKEN_PROGRAM_ADDRESS,
    }),
  ])
  const sourceAta = sourceAtaTuple[0]
  const destinationAta = destinationAtaTuple[0]

  const rpcUrl = rpcUrlOverride && rpcUrlOverride.length > 0 ? rpcUrlOverride : DEFAULT_SOLANA_RPC
  const rpc = deps.createSolanaRpc(rpcUrl)
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()

  const instructions = [
    // Keep the compute-unit limit under the facilitator's fee-payer cap
    // (PayAI rejects > ~60,000 CU). 50,000 is comfortably under and far above
    // the ~7,000 CU an SPL TransferChecked + compute-budget ixs consume.
    deps.getSetComputeUnitLimitInstruction({ units: computeUnitLimitOverride ?? 50_000 }),
    deps.getSetComputeUnitPriceInstruction({ microLamports: 1_000n }),
    deps.getTransferCheckedInstruction({
      source: sourceAta,
      mint: mintAddress,
      destination: destinationAta,
      authority: signer,
      amount,
      decimals,
    }),
  ]

  const message = deps.pipe(
    deps.createTransactionMessage({ version: 0 }),
    (m: any) => deps.setTransactionMessageFeePayer(feePayerAddress, m),
    (m: any) => deps.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m: any) => deps.appendTransactionMessageInstructions(instructions, m),
  )

  // Partially sign — fills the payer's signature slot, leaves the fee payer's
  // slot empty for the facilitator to fill in at /settle time.
  const partiallySigned = await deps.partiallySignTransactionMessageWithSigners(message)
  const base64Tx = deps.getBase64EncodedWireTransaction(partiallySigned)

  const envelope: X402PaymentEnvelope = {
    x402Version: echoedVersion,
    scheme: 'exact',
    network: requirements.network,
    payload: { transaction: base64Tx },
  }
  return Buffer.from(JSON.stringify(envelope)).toString('base64')
}

// ── EVM signer (EIP-3009 transferWithAuthorization) ──────────────────────────

function randomHex32(): `0x${string}` {
  const buf = Buffer.alloc(32)
  for (let i = 0; i < 32; i++) buf[i] = Math.floor(Math.random() * 256)
  return ('0x' + buf.toString('hex')) as `0x${string}`
}

export async function signX402PaymentEvm(
  requirements: X402PaymentRequirements,
  rawKey: string,
  echoedVersion: number = 1,
): Promise<string> {
  if (requirements.scheme !== 'exact') {
    throw new Error(`MPP32: EVM x402 scheme "${requirements.scheme}" not implemented; only "exact" is supported.`)
  }

  const chain = chainSpecFor(requirements.network)
  const tokenName = requirements.extra?.name ?? 'USD Coin'
  const tokenVersion = requirements.extra?.version ?? '2'
  const assetAddr = requirements.asset
  if (!/^0x[0-9a-fA-F]{40}$/.test(assetAddr)) {
    throw new Error(`MPP32: EVM x402 challenge asset is not a valid 0x address: ${requirements.asset}`)
  }
  const recipientAddr = requirements.payTo
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipientAddr)) {
    throw new Error(`MPP32: EVM x402 challenge payTo is not a valid 0x address: ${requirements.payTo}`)
  }

  const value = BigInt(requirements.maxAmountRequired)
  if (value <= 0n) throw new Error(`MPP32: Invalid maxAmountRequired: ${requirements.maxAmountRequired}`)

  const keyHex = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('MPP32: EVM private key must be a 64-character hex key (0x-prefixed or bare).')
  }
  const { privateKeyToAccount } = await loadEvmDeps()
  const account = privateKeyToAccount(keyHex as `0x${string}`)

  // Self-payment guard (EVM). EIP-3009 with from == to is rejected on-chain.
  if (account.address.toLowerCase() === recipientAddr.toLowerCase()) {
    throw new Error(
      `MPP32: Refusing to sign an x402 payment to yourself: the wallet derived from your EVM key ` +
        `(${account.address}) is also the payment recipient (payTo). Use a different payer wallet.`,
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const validAfter = BigInt(0)
  const validBefore = BigInt(now + (requirements.maxTimeoutSeconds ?? 600))
  const nonce = randomHex32()

  const domain = {
    name: tokenName,
    version: tokenVersion,
    chainId: chain.chainId,
    verifyingContract: assetAddr as `0x${string}`,
  }
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  } as const
  const messageObj = {
    from: account.address,
    to: recipientAddr as `0x${string}`,
    value,
    validAfter,
    validBefore,
    nonce,
  }

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message: messageObj,
  })

  const envelope: X402PaymentEnvelope = {
    x402Version: echoedVersion,
    scheme: 'exact',
    network: requirements.network,
    payload: {
      signature,
      authorization: {
        from: messageObj.from,
        to: messageObj.to,
        value: messageObj.value.toString(),
        validAfter: messageObj.validAfter.toString(),
        validBefore: messageObj.validBefore.toString(),
        nonce: messageObj.nonce,
      },
    },
  }
  return Buffer.from(JSON.stringify(envelope)).toString('base64')
}

// ── v1 / v2 challenge handling ───────────────────────────────────────────────
//
// Two on-the-wire challenge shapes are in use across the ecosystem:
//   v1 (our backend today): { scheme, network, asset, payTo, maxAmountRequired,
//        resource, extra, ... }
//   v2 (Coinbase reference + most third parties): { x402Version: 2, resource,
//        accepts: [{ scheme, network, asset, payTo, amount, extra }, ...] }
// v2 uses `amount` instead of `maxAmountRequired` and nests requirements in an
// `accepts` array. We read both and echo the matching outgoing version.

interface X402V2Challenge {
  x402Version?: number
  accepts: unknown[]
  resource?: unknown
}

function isV2Challenge(decoded: unknown): decoded is X402V2Challenge {
  return (
    !!decoded &&
    typeof decoded === 'object' &&
    Array.isArray((decoded as { accepts?: unknown }).accepts)
  )
}

function normalizeRequirements(raw: Record<string, unknown>): X402PaymentRequirements {
  const amount =
    (raw.maxAmountRequired as string | undefined) ?? (raw.amount as string | undefined) ?? ''
  return {
    scheme: String(raw.scheme ?? 'exact'),
    network: String(raw.network ?? ''),
    maxAmountRequired: amount,
    resource: String(raw.resource ?? ''),
    description: raw.description as string | undefined,
    mimeType: raw.mimeType as string | undefined,
    payTo: String(raw.payTo ?? ''),
    maxTimeoutSeconds: raw.maxTimeoutSeconds as number | undefined,
    asset: String(raw.asset ?? ''),
    outputSchema: raw.outputSchema,
    extra: raw.extra as X402PaymentRequirements['extra'],
  }
}

// Pick the first `accepts` entry we can actually sign.
function pickRequirements(
  accepts: X402PaymentRequirements[],
  haveSvm: boolean,
  haveEvm: boolean,
  preferredNetwork?: string,
): X402PaymentRequirements {
  if (accepts.length === 0) {
    throw new Error('MPP32: x402 v2 challenge has empty `accepts` array — nothing to pay.')
  }

  if (preferredNetwork) {
    const want = preferredNetwork.toLowerCase()
    const explicit = accepts.find((a) => {
      const n = a.network.toLowerCase()
      if (n === want) return true
      if (want === 'solana' && isSvmNetwork(a.network)) return true
      if ((want === 'base' || want === 'evm') && isEvmNetwork(a.network)) return true
      return false
    })
    if (explicit) return explicit
  }

  // Single-key users: prefer the network they can pay.
  if (haveSvm && !haveEvm) {
    const svm = accepts.find((a) => isSvmNetwork(a.network))
    if (svm) return svm
  }
  if (haveEvm && !haveSvm) {
    const evm = accepts.find((a) => isEvmNetwork(a.network))
    if (evm) return evm
  }
  // Both keys: prefer EVM (Base is the dominant chain).
  if (haveEvm && haveSvm) {
    const evm = accepts.find((a) => isEvmNetwork(a.network))
    if (evm) return evm
    const svm = accepts.find((a) => isSvmNetwork(a.network))
    if (svm) return svm
  }
  return accepts[0]!
}

// ── Public orchestrator ───────────────────────────────────────────────────────

export async function signX402Payment(args: SignX402Args): Promise<SignX402Result> {
  let decoded: unknown
  try {
    const json = Buffer.from(args.paymentRequiredHeader, 'base64').toString('utf-8')
    decoded = JSON.parse(json)
  } catch (err) {
    throw new Error(
      `MPP32: Could not decode Payment-Required header as base64 JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  let requirements: X402PaymentRequirements
  let echoedVersion: number
  if (isV2Challenge(decoded)) {
    const accepts: X402PaymentRequirements[] = decoded.accepts
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map(normalizeRequirements)
    requirements = pickRequirements(accepts, !!args.solanaKey, !!args.evmKey, args.preferredNetwork)
    echoedVersion = decoded.x402Version || 2
  } else if (decoded && typeof decoded === 'object') {
    requirements = normalizeRequirements(decoded as Record<string, unknown>)
    echoedVersion = (decoded as { x402Version?: number }).x402Version || 1
  } else {
    throw new Error('MPP32: Decoded Payment-Required is not a JSON object.')
  }

  if (!requirements.network) throw new Error("MPP32: x402 payment requirements missing 'network'")
  if (!requirements.asset) throw new Error("MPP32: x402 payment requirements missing 'asset'")
  if (!requirements.payTo) throw new Error("MPP32: x402 payment requirements missing 'payTo'")
  if (!requirements.maxAmountRequired) {
    throw new Error("MPP32: x402 payment requirements missing 'maxAmountRequired'/'amount'")
  }

  if (isSvmNetwork(requirements.network)) {
    if (!args.solanaKey) {
      throw new Error(
        `MPP32: Provider requires SVM payment on ${requirements.network}, but no Solana private key is configured. ` +
          `Construct MPP32 with { solanaPrivateKey } (or MPP32_SOLANA_PRIVATE_KEY) to pay USDC on Solana.`,
      )
    }
    const header = await signX402PaymentSvm(requirements, args.solanaKey, args.solanaRpcUrl, echoedVersion)
    return { xPaymentHeader: header, network: requirements.network, scheme: requirements.scheme, protocolUsed: 'x402-svm' }
  }

  if (isEvmNetwork(requirements.network)) {
    if (!args.evmKey) {
      throw new Error(
        `MPP32: Provider requires EVM payment on ${requirements.network}, but no EVM private key is configured. ` +
          `Construct MPP32 with { tempoPrivateKey } (an EVM key) to pay USDC on Base/Ethereum.`,
      )
    }
    const header = await signX402PaymentEvm(requirements, args.evmKey, echoedVersion)
    return { xPaymentHeader: header, network: requirements.network, scheme: requirements.scheme, protocolUsed: 'x402-evm' }
  }

  throw new Error(
    `MPP32: Unsupported x402 network "${requirements.network}". Supported: solana:*, base, base-sepolia, ethereum ` +
      `(and their eip155:* aliases).`,
  )
}
