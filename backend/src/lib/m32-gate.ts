import { createMiddleware } from 'hono/factory'
import { getM32Balance } from './solana-token.js'
import { logger } from './mpp.js'

export const M32_EXCLUSIVE_APIS = [
  {
    id: 'whale-tracker',
    name: 'Whale Tracker',
    description: 'Real-time large-wallet movement detection for any Solana token',
    requiredM32: 1_000_000,
    price: 'Free for holders',
    endpoint: '/api/m32/whale-tracker',
  },
  {
    id: 'token-compare',
    name: 'Token Comparison',
    description: 'Head-to-head intelligence comparison of two Solana tokens',
    requiredM32: 2_500_000,
    price: 'Free for holders',
    endpoint: '/api/m32/compare',
  },
  {
    id: 'portfolio-scanner',
    name: 'Portfolio Scanner',
    description: 'Full portfolio intelligence scan for any Solana wallet',
    requiredM32: 5_000_000,
    price: 'Free for holders',
    endpoint: '/api/m32/portfolio',
  },
] as const

/**
 * Middleware factory that gates access by M32 token balance.
 * Returns 403 with details if insufficient balance, 503 if balance check fails.
 * On success, stores `m32Balance` and `m32Wallet` on the Hono context.
 */
export function requireM32(minimumBalance: number, apiName: string) {
  return createMiddleware(async (c, next) => {
    const wallet = c.req.header('x-wallet-address')?.trim()
    if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      return c.json(
        {
          error: {
            message: `${apiName} is exclusive to M32 token holders. Include your Solana wallet address in the X-Wallet-Address header.`,
            code: 'M32_WALLET_REQUIRED',
            requiredBalance: minimumBalance,
            tokenMint: '6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump',
            buyUrl:
              'https://raydium.io/swap/?inputMint=sol&outputMint=6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump',
          },
        },
        403,
      )
    }

    let balance = 0
    try {
      balance = await getM32Balance(wallet)
    } catch (err) {
      logger.warn('M32 gate balance check failed', { wallet, error: String(err) })
      return c.json(
        {
          error: {
            message: 'Unable to verify M32 balance. Please try again.',
            code: 'M32_BALANCE_CHECK_FAILED',
          },
        },
        503,
      )
    }

    if (balance < minimumBalance) {
      return c.json(
        {
          error: {
            message: `${apiName} requires holding ${minimumBalance.toLocaleString()} M32 tokens. Your balance: ${balance.toLocaleString()} M32.`,
            code: 'M32_INSUFFICIENT_BALANCE',
            requiredBalance: minimumBalance,
            currentBalance: balance,
            deficit: minimumBalance - balance,
            tokenMint: '6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump',
            buyUrl:
              'https://raydium.io/swap/?inputMint=sol&outputMint=6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump',
          },
        },
        403,
      )
    }

    // Store balance on context for downstream use
    c.set('m32Balance' as never, balance as never)
    c.set('m32Wallet' as never, wallet as never)
    await next()
  })
}
