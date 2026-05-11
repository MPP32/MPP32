// x402 protocol-compliant payment signers.
//
// Two schemes are implemented end-to-end here. Both follow the official
// `exact` scheme from https://x402.org and the reference implementation at
// https://github.com/coinbase/x402.
//
//   • SVM (Solana): build a 3-instruction Solana VersionedTransaction
//       (SetComputeUnitLimit, SetComputeUnitPrice, SPL-Token TransferChecked
//       between Associated Token Accounts), set the facilitator-advertised
//       fee payer, partially sign with the payer's Ed25519 keypair, and
//       base64-encode the wire transaction. The fee-payer signature slot is
//       left empty — the facilitator fills it during /settle.
//   • EVM (Base / Base-Sepolia): sign an EIP-3009 `transferWithAuthorization`
//       typed data message with the payer's secp256k1 key using viem. The
//       resulting signature plus authorization parameters form the payload.
//
// In both cases the outer envelope is
//   { x402Version: 1, scheme: "exact", network, payload: <scheme payload> }
// base64-encoded into the `X-Payment` HTTP header.

// All heavy crypto dependencies are loaded lazily inside the signer functions.
// Reason: Claude Desktop ships a bundled Node binary that historically has
// been Node 18.x. `@solana/kit` and its `@solana/*` sub-packages declare
// `engines.node: ">=20.18.0"` and use Node-20-only WebCrypto Ed25519 APIs
// at module load. If we imported them at the top of this file, the entire
// MCP server would crash on startup on Node 18, producing the opaque
// "Server disconnected" error in Claude Desktop before the user could even
// see a useful diagnostic. By dynamic-importing inside the signer, the
// server boots fine on any Node version that supports MCP, and only the
// payment call itself fails — with a clear, actionable error message.

// Type-only imports stay top-level; they erase at compile time.
import type { Address } from "@solana/kit";

async function loadSvmDeps() {
  const [kit, tokenProgram, computeBudgetProgram, bs58Mod, naclMod] = await Promise.all([
    import("@solana/kit"),
    import("@solana-program/token"),
    import("@solana-program/compute-budget"),
    import("bs58"),
    import("tweetnacl"),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not load Solana signing libraries: ${msg}. ` +
        `Solana x402 payments require Node 20.18 or newer (Claude Desktop's bundled Node may be older). ` +
        `Upgrade Node, or run mpp32-mcp-server under a system Node 20+ via your MCP config's "command".`,
    );
  });
  return {
    address: kit.address,
    createKeyPairSignerFromBytes: kit.createKeyPairSignerFromBytes,
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
    bs58: bs58Mod.default ?? (bs58Mod as unknown as { decode: (s: string) => Uint8Array }),
    nacl: naclMod.default ?? (naclMod as unknown as { sign: { keyPair: { fromSeed: (s: Uint8Array) => { secretKey: Uint8Array } } } }),
  };
}

async function loadEvmDeps() {
  try {
    const viemAccounts = await import("viem/accounts");
    return { privateKeyToAccount: viemAccounts.privateKeyToAccount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not load EVM signing libraries: ${msg}. ` +
        `Base / Ethereum x402 payments require Node 18 or newer. Upgrade Node and retry.`,
    );
  }
}

export interface X402PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  asset: string;
  outputSchema?: unknown;
  extra?: {
    feePayer?: string;
    name?: string;
    version?: string;
    decimals?: number;
    [k: string]: unknown;
  };
}

export interface X402PaymentEnvelope {
  x402Version: number;
  scheme: string;
  network: string;
  payload: unknown;
}

// ── Network classification ──────────────────────────────────────────────────

const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

export function isSvmNetwork(network: string): boolean {
  return network.startsWith("solana") || network === "solana-mainnet" || network === "solana-devnet";
}

export function isEvmNetwork(network: string): boolean {
  if (network.startsWith("eip155:")) return true;
  return ["base", "base-sepolia", "ethereum", "ethereum-sepolia"].includes(network);
}

interface EvmChainSpec {
  chainId: number;
  name: string;
  rpcUrl: string;
}

function chainSpecFor(network: string): EvmChainSpec {
  if (network === "base" || network === "eip155:8453") {
    return { chainId: 8453, name: "Base", rpcUrl: "https://mainnet.base.org" };
  }
  if (network === "base-sepolia" || network === "eip155:84532") {
    return { chainId: 84532, name: "Base Sepolia", rpcUrl: "https://sepolia.base.org" };
  }
  if (network === "ethereum" || network === "eip155:1") {
    return { chainId: 1, name: "Ethereum", rpcUrl: "https://eth.llamarpc.com" };
  }
  throw new Error(`Unsupported EVM network "${network}". x402 EVM payments currently support: base, base-sepolia, ethereum.`);
}

// ── Key decoding ────────────────────────────────────────────────────────────

type SvmDeps = Awaited<ReturnType<typeof loadSvmDeps>>;

function decodeSolanaSecret(raw: string, deps: SvmDeps): Uint8Array {
  if (raw.startsWith("[")) {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error("Solana secret JSON array malformed");
    return new Uint8Array(arr);
  }
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    return new Uint8Array(Buffer.from(raw, "hex"));
  }
  return deps.bs58.decode(raw);
}

async function buildSolanaSigner(rawKey: string, deps: SvmDeps) {
  let bytes = decodeSolanaSecret(rawKey, deps);
  if (bytes.length === 32) {
    // 32-byte seed — kit's createKeyPairSignerFromBytes wants the 64-byte
    // expanded key. Derive via tweetnacl.
    const kp = deps.nacl.sign.keyPair.fromSeed(bytes);
    bytes = kp.secretKey;
  } else if (bytes.length !== 64) {
    throw new Error(`Solana private key must be a 32-byte seed or a 64-byte expanded key; got ${bytes.length} bytes.`);
  }
  return await deps.createKeyPairSignerFromBytes(bytes);
}

// ── SVM signer ──────────────────────────────────────────────────────────────

const DEFAULT_SOLANA_RPC = "https://api.mainnet-beta.solana.com";

export async function signX402PaymentSvm(
  requirements: X402PaymentRequirements,
  rawKey: string,
  rpcUrlOverride?: string,
  echoedVersion: number = 1,
): Promise<string> {
  if (requirements.scheme !== "exact") {
    throw new Error(`SVM x402 scheme "${requirements.scheme}" not implemented; only "exact" is supported.`);
  }
  if (!requirements.extra?.feePayer) {
    throw new Error(
      `SVM x402 challenge is missing extra.feePayer. The facilitator must advertise a fee-payer address per the x402 spec. ` +
        `If you are calling MPP32 itself, upgrade the backend; if a third-party service, ask them to fix their challenge.`,
    );
  }

  const decimals = requirements.extra?.decimals ?? 6;
  const amount = BigInt(requirements.maxAmountRequired);
  if (amount <= 0n) throw new Error(`Invalid maxAmountRequired: ${requirements.maxAmountRequired}`);

  const deps = await loadSvmDeps();

  const signer = await buildSolanaSigner(rawKey, deps);
  const payerAddress = signer.address;
  const mintAddress = deps.address(requirements.asset);
  const recipientAddress = deps.address(requirements.payTo);
  const feePayerAddress = deps.address(requirements.extra.feePayer);

  // Self-payment guard. An SPL TransferChecked where source ATA == destination
  // ATA is a no-op the Solana runtime rejects, and the resulting facilitator
  // error is opaque ("transaction failed simulation"). This usually means the
  // user configured the same wallet as both their MPP32_SOLANA_PRIVATE_KEY and
  // the upstream payTo (e.g. calling their own listed service, or testing
  // against the MPP32 oracle from the operator wallet). Catch it here with a
  // clear, actionable message before we burn an RPC round-trip.
  if (String(payerAddress) === String(recipientAddress)) {
    throw new Error(
      `Refusing to sign an x402 payment to yourself: the wallet derived from MPP32_SOLANA_PRIVATE_KEY ` +
        `(${String(payerAddress)}) is also the payment recipient (payTo) for this service. ` +
        `Use a different wallet to call this endpoint, or fund a separate payer key.`,
    );
  }

  // Derive both sides' associated token accounts (classic SPL Token program).
  const [sourceAtaTuple, destinationAtaTuple] = await Promise.all([
    deps.findAssociatedTokenPda({
      owner: payerAddress,
      mint: mintAddress,
      tokenProgram: deps.TOKEN_PROGRAM_ADDRESS as Address,
    }),
    deps.findAssociatedTokenPda({
      owner: recipientAddress,
      mint: mintAddress,
      tokenProgram: deps.TOKEN_PROGRAM_ADDRESS as Address,
    }),
  ]);
  const sourceAta = sourceAtaTuple[0];
  const destinationAta = destinationAtaTuple[0];

  const rpcUrl = rpcUrlOverride && rpcUrlOverride.length > 0 ? rpcUrlOverride : DEFAULT_SOLANA_RPC;
  const rpc = deps.createSolanaRpc(rpcUrl);
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  const instructions = [
    deps.getSetComputeUnitLimitInstruction({ units: 150_000 }),
    deps.getSetComputeUnitPriceInstruction({ microLamports: 1_000n }),
    deps.getTransferCheckedInstruction({
      source: sourceAta,
      mint: mintAddress,
      destination: destinationAta,
      authority: signer,
      amount,
      decimals,
    }),
  ];

  const message = deps.pipe(
    deps.createTransactionMessage({ version: 0 }),
    (m) => deps.setTransactionMessageFeePayer(feePayerAddress, m),
    (m) => deps.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => deps.appendTransactionMessageInstructions(instructions, m),
  );

  // Partially sign — fills the payer's signature slot, leaves the fee payer's
  // slot empty for the facilitator to fill in at /settle time.
  const partiallySigned = await deps.partiallySignTransactionMessageWithSigners(message);
  const base64Tx = deps.getBase64EncodedWireTransaction(partiallySigned);

  const envelope: X402PaymentEnvelope = {
    x402Version: echoedVersion,
    scheme: "exact",
    network: requirements.network,
    payload: { transaction: base64Tx },
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64");
}

// ── EVM signer (EIP-3009 transferWithAuthorization) ─────────────────────────

function randomHex32(): `0x${string}` {
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) buf[i] = Math.floor(Math.random() * 256);
  return ("0x" + buf.toString("hex")) as `0x${string}`;
}

export async function signX402PaymentEvm(
  requirements: X402PaymentRequirements,
  rawKey: string,
  echoedVersion: number = 1,
): Promise<string> {
  if (requirements.scheme !== "exact") {
    throw new Error(`EVM x402 scheme "${requirements.scheme}" not implemented; only "exact" is supported.`);
  }

  const chain = chainSpecFor(requirements.network);
  const tokenName = requirements.extra?.name ?? "USD Coin";
  const tokenVersion = requirements.extra?.version ?? "2";
  const assetAddr = requirements.asset as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(assetAddr)) {
    throw new Error(`EVM x402 challenge asset is not a valid 0x address: ${requirements.asset}`);
  }
  const recipientAddr = requirements.payTo as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipientAddr)) {
    throw new Error(`EVM x402 challenge payTo is not a valid 0x address: ${requirements.payTo}`);
  }

  const value = BigInt(requirements.maxAmountRequired);
  if (value <= 0n) throw new Error(`Invalid maxAmountRequired: ${requirements.maxAmountRequired}`);

  const keyHex = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("MPP32_PRIVATE_KEY must be a 64-character hex EVM private key (0x-prefixed or bare).");
  }
  const { privateKeyToAccount } = await loadEvmDeps();
  const account = privateKeyToAccount(keyHex as `0x${string}`);

  // Self-payment guard (EVM). EIP-3009 transferWithAuthorization with
  // from == to is rejected on-chain by USDC. Surfacing this here keeps the
  // error message useful instead of an opaque facilitator failure.
  if (account.address.toLowerCase() === recipientAddr.toLowerCase()) {
    throw new Error(
      `Refusing to sign an x402 payment to yourself: the wallet derived from MPP32_PRIVATE_KEY ` +
        `(${account.address}) is also the payment recipient (payTo) for this service. ` +
        `Use a different wallet to call this endpoint, or fund a separate payer key.`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(0);
  const validBefore = BigInt(now + (requirements.maxTimeoutSeconds ?? 600));
  const nonce = randomHex32();

  const domain = {
    name: tokenName,
    version: tokenVersion,
    chainId: chain.chainId,
    verifyingContract: assetAddr,
  };
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;
  const messageObj = {
    from: account.address,
    to: recipientAddr,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message: messageObj,
  });

  const envelope: X402PaymentEnvelope = {
    x402Version: echoedVersion,
    scheme: "exact",
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
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64");
}

// ── Public orchestrator ─────────────────────────────────────────────────────

export interface SignX402Args {
  paymentRequiredHeader: string;
  solanaKey?: string;
  evmKey?: string;
  solanaRpcUrl?: string;
  // Optional override: "solana" | "base" | "ethereum" | "evm" | full CAIP-2.
  // Sourced from MPP32_PREFERRED_NETWORK in the MCP entrypoint.
  preferredNetwork?: string;
}

export interface SignX402Result {
  xPaymentHeader: string;
  network: string;
  scheme: string;
  protocolUsed: "x402-svm" | "x402-evm";
}

// Two on-the-wire shapes are in use across the ecosystem today:
//
//   v1 (the original x402 spec, what our own backend emits today):
//     { scheme, network, asset, payTo, maxAmountRequired, resource, extra, ... }
//
//   v2 (what Coinbase's reference impl and every third-party provider we
//   tested — Venice, Exa, Firecrawl-via-x402, OpenAI x402 gateway — actually
//   ship):
//     { x402Version: 2, resource, accepts: [{ scheme, network, asset, payTo,
//       amount, maxTimeoutSeconds, extra }, ...], extensions?, error? }
//
// The v1 → v2 differences that matter for signing:
//   • `accepts: [...]` array instead of a single top-level requirements blob
//   • `amount` instead of `maxAmountRequired`
//   • `x402Version` is mandatory and tells the server which envelope version
//     to expect back in `X-Payment`
//
// The signer must read both and emit the matching outgoing version.

interface X402V2Challenge {
  x402Version?: number;
  accepts: unknown[];
  resource?: unknown;
  extensions?: unknown;
  error?: string;
}

function isV2Challenge(decoded: unknown): decoded is X402V2Challenge {
  return (
    !!decoded &&
    typeof decoded === "object" &&
    Array.isArray((decoded as { accepts?: unknown }).accepts)
  );
}

// Normalize a v2 `accepts[i]` to our internal requirements shape. v2 uses
// `amount`, v1 uses `maxAmountRequired` — we map both into the same field so
// the downstream signers don't have to know which version produced the input.
function normalizeRequirements(raw: Record<string, unknown>): X402PaymentRequirements {
  const amount =
    (raw.maxAmountRequired as string | undefined) ?? (raw.amount as string | undefined) ?? "";
  return {
    scheme: String(raw.scheme ?? "exact"),
    network: String(raw.network ?? ""),
    maxAmountRequired: amount,
    resource: String(raw.resource ?? ""),
    description: raw.description as string | undefined,
    mimeType: raw.mimeType as string | undefined,
    payTo: String(raw.payTo ?? ""),
    maxTimeoutSeconds: raw.maxTimeoutSeconds as number | undefined,
    asset: String(raw.asset ?? ""),
    outputSchema: raw.outputSchema,
    extra: raw.extra as X402PaymentRequirements["extra"],
  };
}

// Pick the first entry in `accepts` we can actually sign.
//
// Preference rules (in order):
//   1. If MPP32_PREFERRED_NETWORK env var matches a `network` field, use it.
//   2. If only one key is configured, prefer that network (this is the most
//      common real-world case — a Solana-only user offered a mixed challenge
//      previously got signed EVM and failed with "no EVM key set". Now they
//      get signed SVM.).
//   3. If both keys are configured, prefer EVM (Base is the dominant chain
//      and tends to settle faster).
//   4. Otherwise fall back to the first accepted entry and let the per-network
//      signer throw a precise "you need MPP32_X_PRIVATE_KEY" error.
function pickRequirements(
  accepts: X402PaymentRequirements[],
  haveSvm: boolean,
  haveEvm: boolean,
  preferredNetwork?: string,
): X402PaymentRequirements {
  if (accepts.length === 0) {
    throw new Error("x402 v2 challenge has empty `accepts` array — nothing to pay.");
  }

  // Explicit preference wins.
  if (preferredNetwork) {
    const want = preferredNetwork.toLowerCase();
    const explicit = accepts.find((a) => {
      const n = a.network.toLowerCase();
      if (n === want) return true;
      if (want === "solana" && isSvmNetwork(a.network)) return true;
      if ((want === "base" || want === "evm") && isEvmNetwork(a.network)) return true;
      return false;
    });
    if (explicit) return explicit;
  }

  // Solana-only user: prefer SVM.
  if (haveSvm && !haveEvm) {
    const svm = accepts.find((a) => isSvmNetwork(a.network));
    if (svm) return svm;
  }
  // EVM-only user: prefer EVM.
  if (haveEvm && !haveSvm) {
    const evm = accepts.find((a) => isEvmNetwork(a.network));
    if (evm) return evm;
  }
  // Both keys configured: prefer EVM (Base is the dominant chain).
  if (haveEvm && haveSvm) {
    const evm = accepts.find((a) => isEvmNetwork(a.network));
    if (evm) return evm;
    const svm = accepts.find((a) => isSvmNetwork(a.network));
    if (svm) return svm;
  }
  return accepts[0];
}

export async function signX402Payment(args: SignX402Args): Promise<SignX402Result> {
  let decoded: unknown;
  try {
    const json = Buffer.from(args.paymentRequiredHeader, "base64").toString("utf-8");
    decoded = JSON.parse(json);
  } catch (err) {
    throw new Error(
      `Could not decode Payment-Required header as base64 JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Resolve v1 vs v2. v2's `x402Version` field tells the server which envelope
  // shape to expect back — we mirror whichever the challenge used.
  let requirements: X402PaymentRequirements;
  let echoedVersion: number;
  if (isV2Challenge(decoded)) {
    const accepts: X402PaymentRequirements[] = decoded.accepts
      .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
      .map(normalizeRequirements);
    requirements = pickRequirements(accepts, !!args.solanaKey, !!args.evmKey, args.preferredNetwork);
    echoedVersion = decoded.x402Version || 2;
  } else if (decoded && typeof decoded === "object") {
    requirements = normalizeRequirements(decoded as Record<string, unknown>);
    echoedVersion = (decoded as { x402Version?: number }).x402Version || 1;
  } else {
    throw new Error("Decoded Payment-Required is not a JSON object.");
  }

  if (!requirements.network) throw new Error("x402 payment requirements missing 'network'");
  if (!requirements.asset) throw new Error("x402 payment requirements missing 'asset'");
  if (!requirements.payTo) throw new Error("x402 payment requirements missing 'payTo'");
  if (!requirements.maxAmountRequired) {
    throw new Error("x402 payment requirements missing 'maxAmountRequired'/'amount'");
  }

  if (isSvmNetwork(requirements.network)) {
    if (!args.solanaKey) {
      throw new Error(
        `Provider requires SVM payment on ${requirements.network}, but MPP32_SOLANA_PRIVATE_KEY is not configured. ` +
          `Set it in your MCP config to enable USDC-on-Solana payments.`,
      );
    }
    const header = await signX402PaymentSvm(requirements, args.solanaKey, args.solanaRpcUrl, echoedVersion);
    return {
      xPaymentHeader: header,
      network: requirements.network,
      scheme: requirements.scheme,
      protocolUsed: "x402-svm",
    };
  }

  if (isEvmNetwork(requirements.network)) {
    if (!args.evmKey) {
      throw new Error(
        `Provider requires EVM payment on ${requirements.network}, but MPP32_PRIVATE_KEY is not configured. ` +
          `Set it in your MCP config to enable USDC-on-Base payments.`,
      );
    }
    const header = await signX402PaymentEvm(requirements, args.evmKey, echoedVersion);
    return {
      xPaymentHeader: header,
      network: requirements.network,
      scheme: requirements.scheme,
      protocolUsed: "x402-evm",
    };
  }

  if (requirements.network === "" || requirements.network === undefined) {
    throw new Error(
      `Provider's x402 challenge does not specify a network. We cannot pay it. Ask the provider to fix their challenge.`,
    );
  }

  throw new Error(
    `Unsupported x402 network "${requirements.network}". Supported: solana:*, base, base-sepolia, ethereum (and their eip155:* aliases). ` +
      `If this network is real and we should support it, file an issue.`,
  );
}
