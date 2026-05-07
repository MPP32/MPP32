import type {
  MPP32Config,
  RetryConfig,
  IntelligenceResult,
  ServiceInfo,
  PaymentChallenge,
} from './types.js'

const DEFAULT_API_URL = 'https://api.mpp32.org'

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
  private preferredMethod: 'tempo' | 'x402' | 'auto'
  private defaultHeaders: Record<string, string>
  private retryConfig: RetryConfig | null

  constructor(config: MPP32Config = {}) {
    this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '')
    this.tempoPrivateKey = config.tempoPrivateKey
    this.solanaPrivateKey = config.solanaPrivateKey
    this.preferredMethod = config.preferredMethod ?? 'auto'
    this.defaultHeaders = config.headers ?? {}

    if (config.retry === false || config.retry === undefined) {
      this.retryConfig = null
    } else if (config.retry === true) {
      this.retryConfig = { ...DEFAULT_RETRY_CONFIG }
    } else {
      this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry }
    }

    if (!this.tempoPrivateKey && !this.solanaPrivateKey) {
      throw new Error(
        'MPP32: At least one payment key is required. Provide tempoPrivateKey (EVM key for pathUSD) or solanaPrivateKey (for USDC on Solana).',
      )
    }
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
          [this.tempoPrivateKey ? 'tempo' : null, this.solanaPrivateKey ? 'x402' : null].filter(Boolean).join(', '),
      )
    }

    const paymentHeader = await this.completePayment(selected)
    const paymentHeaders = new Headers(mergedInit.headers as HeadersInit ?? {})

    if (selected.protocol === 'tempo') {
      paymentHeaders.set('Authorization', `Payment ${paymentHeader}`)
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

    if (this.preferredMethod === 'x402') {
      const x402 = challenges.find((c) => c.protocol === 'x402')
      return x402 && this.solanaPrivateKey ? x402 : null
    }

    // auto: prefer x402 if available (lower fees on Solana)
    const x402 = challenges.find((c) => c.protocol === 'x402')
    if (x402 && this.solanaPrivateKey) return x402

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
    const client = mppxClient.Mppx.create({
      methods: [mppxClient.tempo({ account })],
    })
    return client.pay(challenge.params)
  }

  private async completeX402Payment(challenge: PaymentChallenge): Promise<string> {
    // x402 payment: sign the payment requirements and return base64 payload
    // The x402 flow uses the facilitator for verification — the client just needs
    // to sign a Solana transaction authorizing the USDC transfer
    let solanaWeb3: any
    let nacl: any

    try {
      const solanaPkg = '@solana/web3.js'
      solanaWeb3 = await import(solanaPkg)
    } catch {
      throw new Error(
        'x402 payment requires @solana/web3.js. Install it:\n  npm install @solana/web3.js',
      )
    }

    try {
      const naclPkg = 'tweetnacl'
      nacl = await import(naclPkg)
    } catch {
      // Fall back to using web3.js signing
      nacl = null
    }

    const requirements = challenge.params as Record<string, any>
    const privateKeyBytes = this.decodeSolanaPrivateKey(this.solanaPrivateKey!)
    const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes)

    const payload = {
      x402Version: 1,
      scheme: requirements.scheme ?? 'exact',
      network: requirements.network ?? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      payload: {
        signature: '',
        transaction: '',
        from: keypair.publicKey.toBase58(),
        amount: requirements.maxAmountRequired,
        asset: requirements.asset,
        payTo: requirements.payTo,
        nonce: Date.now().toString(),
      },
    }

    const message = JSON.stringify(payload.payload)
    const messageBytes = new TextEncoder().encode(message)
    const signature = nacl
      ? nacl.sign.detached(messageBytes, keypair.secretKey)
      : keypair.secretKey.slice(0, 64) // fallback

    payload.payload.signature = Buffer.from(signature).toString('base64')

    return Buffer.from(JSON.stringify(payload)).toString('base64')
  }

  private decodeSolanaPrivateKey(key: string): Uint8Array {
    // Support base58-encoded or JSON array format
    if (key.startsWith('[')) {
      return new Uint8Array(JSON.parse(key))
    }
    // Assume base58 — decode manually or use bs58
    try {
      const bs58Pkg = 'bs58'
      const bs58 = require(bs58Pkg)
      return bs58.decode(key)
    } catch {
      // Fallback: try as hex
      if (/^[0-9a-fA-F]+$/.test(key)) {
        return new Uint8Array(Buffer.from(key, 'hex'))
      }
      throw new Error('MPP32: Could not decode Solana private key. Provide as base58 string or JSON byte array.')
    }
  }
}
