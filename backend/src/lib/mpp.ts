import { Mppx, tempo } from 'mppx/hono'
import { env } from '../env.js'

// secretKey is used to bind challenges to their contents for stateless verification.
// Falls back to a derived value if MPP_SECRET_KEY is not set.
const secretKey = env.MPP_SECRET_KEY ?? 'mpp-default-secret-change-in-production'

export const mppx = Mppx.create({
  secretKey,
  methods: [
    tempo.charge({
      currency: env.TEMPO_CURRENCY_ADDRESS as `0x${string}`,
      recipient: env.TEMPO_RECIPIENT_ADDRESS as `0x${string}`,
    }),
  ],
})
