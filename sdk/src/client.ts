import type {
  MPP32Config,
  RetryConfig,
  IntelligenceResult,
  ServiceInfo,
  PaymentChallenge,
} from './types.js'
import { signX402Payment } from './x402-signers.js'

const DEFAULT_API_URL = 'https://mpp32.org'
const SDK_VERSION = '0.1.1'

// Read an env var without assuming a Node global is present (browser/edge safe).
function readEnv(name: string): string | undefined {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return p?.env?.[name]
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
}

export class MPP32 {
  private apiUrl: string
  private tempoPrivateKey?: string
  private solanaPrivateKey?: string
  private solanaRpcUrl?: string
  private agentKey?: string
  private preferredMethod: 'tempo' | 'x402' | 'auto'
  private defaultHeaders: Record<string, string>
  private retryConfig: RetryConfig | null

  constructor(config: MPP32Config = {}) {
    this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '')
    this.tempoPrivateKey = config.tempoPrivateKey
    this.solanaPrivateKey = config.solanaPrivateKey
    this.solanaRpcUrl = config.solanaRpcUrl ?? readEnv('MPP32_SOLANA_RPC_URL')
    // Agent key enables the free tier, dashboard usage tracking, and calling
    // federated catalog entries — no wallet required. Mirrors how the MPP32 MCP
    // server sends X-Agent-Key on POST /api/agent/execute.
    this.agentKey = config.agentKey ?? readEnv('MPP32_AGENT_KEY')
    this.preferredMethod = config.preferredMethod ?? 'auto'
    this.defaultHeaders = config.headers ?? {}

    if (config.retry === false || config.retry === undefined) {
      this.retryConfig = null
    } else if (config.retry === true) {
      this.retryConfig = { ...DEFAULT_RETRY_CONFIG }
    } else {
      this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry }
    }

    // No key is required to construct the client: free-tier and read-only calls
    // (listServices, agent-key'd analyze) work without a wallet. A private key is
    // only required when a real 402 challenge must actually be signed — that case
    // fails loudly at payment time (see selectPaymentMethod / completePayment).
  }

  async analyze(token: string): Promise<IntelligenceResult> {
    const res = await this.paidFetch(`${this.apiUrl}/api/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(`MPP32 analyze failed (${res.status}): ${(err as any)?.error?.message ?? res.statusText}`)
    }

    const json = (await res.json()) as { data: IntelligenceResult }
    return json.data
  }

  async listServices(category?: string): Promise<ServiceInfo[]> {
    const url = new URL('/api/submissions', this.apiUrl)
    const res = await this.fetchWithRetry(url.toString(), {
      headers: { ...this.defaultHeaders },
    })

    if (!res.ok) {
      throw new Error(`MPP32 listServices failed (${res.status}): ${res.statusText}`)
    }

    const json = (await res.json()) as { data: ServiceInfo[] }
    let services = json.data
    if (category) {
      services = services.filter(
        (s) => s.category.toLowerCase() === category.toLowerCase(),
      )
    }
    return services
  }

  async callService(
    slug: string,
    options: { method?: string; body?: string; query?: Record<string, string>; headers?: Record<string, string> } = {},
  ): Promise<unknown> {
    const url = new URL(`/api/proxy/${encodeURIComponent(slug)}`, this.apiUrl)
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        url.searchParams.set(k, v)
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
    if (options.body) headers['Content-Type'] = 'application/json'

    const res = await this.paidFetch(url.toString(), {
      method: options.method ?? 'POST',
      headers,
      body: options.body,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(`MPP32 callService failed (${res.status}): ${(err as any)?.error?.message ?? res.statusText}`)
    }

    return res.json()
  }

  async paidFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const mergedInit = this.mergeHeaders(init)
    const challengeRes = await this.fetchWithRetry(url, mergedInit)

    if (challengeRes.status !== 402) {
      return challengeRes
    }

    const challenges = this.parsePaymentChallenges(challengeRes)
    const selected = this.selectPaymentMethod(challenges)

    if (!selected) {
      throw new Error(
        'MPP32: No compatible payment method available. Server offered: ' +
          challenges.map((c) => c.protocol).join(', ') +
          '. You have keys for: ' +
          [
            this.tempoPrivateKey ? 'tempo' : null,
            this.solanaPrivateKey || this.tempoPrivateKey ? 'x402' : null,
          ]
            .filter(Boolean)
            .join(', ') +
          '. Provide solanaPrivateKey (USDC on Solana) or tempoPrivateKey (EVM) to sign a payment.',
      )
    }

    const paymentHeader = await this.completePayment(selected)
    const paymentHeaders = new Headers(mergedInit.headers as HeadersInit ?? {})

    if (selected.protocol === 'tempo') {
      // completeTempoPayment returns the full header value ("Payment <b64>",
      // mppx Credential.serialize format) — set it verbatim.
      paymentHeaders.set('Authorization', paymentHeader)
    } else {
      paymentHeaders.set('X-Payment', paymentHeader)
    }

    return this.fetchWithRetry(url, { ...mergedInit, headers: paymentHeaders })
  }

  private mergeHeaders(init: RequestInit): RequestInit {
    if (Object.keys(this.defaultHeaders).length === 0) return init

    const existing = init.headers as Record<string, string> | undefined
    return {
      ...init,
      headers: { ...this.defaultHeaders, ...existing },
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    // Identify this surface to the backend's usage tracking (mcp/sdk/web split).
    const headers = new Headers(init.headers as HeadersInit ?? {})
    if (!headers.has('X-MPP32-Client')) headers.set('X-MPP32-Client', `sdk/${SDK_VERSION}`)
    // Attach the agent key on every request so free-tier quota, dashboard usage
    // tracking, and federated-catalog access work without a wallet.
    if (this.agentKey && !headers.has('X-Agent-Key')) headers.set('X-Agent-Key', this.agentKey)
    init = { ...init, headers }

    if (!this.retryConfig) return fetch(url, init)

    const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier, retryableStatusCodes } = this.retryConfig
    let lastError: Error | null = null
    let lastResponse: Response | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, init)

        if (!retryableStatusCodes.includes(res.status) || attempt === maxRetries) {
          return res
        }

        lastResponse = res

        const retryAfter = res.headers.get('retry-after')
        if (retryAfter) {
          const retryMs = this.parseRetryAfter(retryAfter)
          if (retryMs !== null) {
            await this.sleep(Math.min(retryMs, maxDelayMs))
            continue
          }
        }
      } catch (err) {
        if (attempt === maxRetries) {
          throw err
        }
        lastError = err as Error
      }

      const baseDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt)
      const jitter = baseDelay * 0.2 * Math.random()
      await this.sleep(Math.min(baseDelay + jitter, maxDelayMs))
    }

    if (lastResponse) return lastResponse
    throw lastError ?? new Error('MPP32: Retry exhausted with no response')
  }

  private parseRetryAfter(header: string): number | null {
    const seconds = Number(header)
    if (!Number.isNaN(seconds) && seconds >= 0) {
      return seconds * 1000
    }
    const date = Date.parse(header)
    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now())
    }
    return null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private parsePaymentChallenges(res: Response): PaymentChallenge[] {
    const challenges: PaymentChallenge[] = []

    const wwwAuth = res.headers.get('www-authenticate')
    if (wwwAuth) {
      const params: Record<string, string> = {}
      const paramRegex = /(\w+)=(?:"([^"]*)"|([\w.+/=-]+))/g
      let m: RegExpExecArray | null
      while ((m = paramRegex.exec(wwwAuth)) !== null) {
        params[m[1]] = m[2] ?? m[3]
      }
      challenges.push({ protocol: 'tempo', rawHeader: wwwAuth, params })
    }

    const paymentRequired = res.headers.get('payment-required')
    if (paymentRequired) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentRequired, 'base64').toString('utf-8'))
        challenges.push({
          protocol: 'x402',
          rawHeader: paymentRequired,
          params: typeof decoded === 'object' ? decoded : {},
        })
      } catch {
        // malformed header, skip
      }
    }

    return challenges
  }

  private selectPaymentMethod(challenges: PaymentChallenge[]): PaymentChallenge | null {
    if (challenges.length === 0) return null

    if (this.preferredMethod === 'tempo') {
      const tempo = challenges.find((c) => c.protocol === 'tempo')
      return tempo && this.tempoPrivateKey ? tempo : null
    }

    // x402 needs an SVM key (Solana challenges) or an EVM key (Base/Ethereum
    // challenges). The exact key is resolved per-network inside signX402Payment,
    // which throws a precise error if the required one is missing.
    const canSignX402 = !!(this.solanaPrivateKey || this.tempoPrivateKey)

    if (this.preferredMethod === 'x402') {
      const x402 = challenges.find((c) => c.protocol === 'x402')
      return x402 && canSignX402 ? x402 : null
    }

    // auto: prefer x402 if available (lower fees on Solana)
    const x402 = challenges.find((c) => c.protocol === 'x402')
    if (x402 && canSignX402) return x402

    const tempo = challenges.find((c) => c.protocol === 'tempo')
    if (tempo && this.tempoPrivateKey) return tempo

    return null
  }

  private async completePayment(challenge: PaymentChallenge): Promise<string> {
    if (challenge.protocol === 'tempo') {
      return this.completeTempoPayment(challenge)
    }
    return this.completeX402Payment(challenge)
  }

  private async completeTempoPayment(challenge: PaymentChallenge): Promise<string> {
    let mppxClient: any
    let viemAccounts: any

    try {
      const mppxPkg = 'mppx/client'
      const viemPkg = 'viem/accounts'
      mppxClient = await import(mppxPkg)
      viemAccounts = await import(viemPkg)
    } catch {
      throw new Error(
        'Tempo payment requires mppx and viem. Install them:\n  npm install mppx viem',
      )
    }

    const key = this.tempoPrivateKey!
    const account = viemAccounts.privateKeyToAccount(
      key.startsWith('0x') ? key : `0x${key}`,
    )
    // polyfill: false — never clobber the host application's globalThis.fetch.
    const client = mppxClient.Mppx.create({
      methods: [mppxClient.tempo({ account })],
      polyfill: false,
    })
    // createCredential parses the challenge from a 402 Response's
    // WWW-Authenticate header, signs the TIP-20 transfer with the local key,
    // and returns the full "Payment <b64>" Authorization value.
    const challengeResponse = new Response(null, {
      status: 402,
      headers: { 'WWW-Authenticate': challenge.rawHeader },
    })
    return client.createCredential(challengeResponse)
  }

  private async completeX402Payment(challenge: PaymentChallenge): Promise<string> {
    // Build a REAL x402-spec-compliant payment envelope and return it as the
    // base64 X-Payment header value.
    //
    // For Solana this is a base64 partially-signed VersionedTransaction (SPL
    // TransferChecked between ATAs, fee-payer slot reserved for the facilitator)
    // — exactly what the backend's verifyX402Envelope / settleX402Payment expect
    // as `paymentPayload`. For Base/Ethereum it is an EIP-3009
    // transferWithAuthorization signature. Both v1 (top-level requirements) and
    // v2 (`accepts` array) challenge shapes are handled, mirroring the MPP32 MCP
    // server. Only signatures ever leave this process — never a private key.
    //
    // `challenge.rawHeader` is the base64 Payment-Required challenge from the
    // server; signX402Payment decodes it and picks the right network/key.
    const result = await signX402Payment({
      paymentRequiredHeader: challenge.rawHeader,
      solanaKey: this.solanaPrivateKey,
      evmKey: this.tempoPrivateKey,
      solanaRpcUrl: this.solanaRpcUrl,
    })
    return result.xPaymentHeader
  }
}
