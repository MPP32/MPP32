// Normalize the messy `network` field on catalog items into a stable chain key.
// Source values seen in the wild: CAIP-2 strings ("eip155:8453", "solana:5eyk…"),
// raw chain names ("base", "solana"), and testnet variants.

export type Chain =
  | 'base'
  | 'base-sepolia'
  | 'solana'
  | 'solana-devnet'
  | 'ethereum'
  | 'optimism'
  | 'polygon'
  | 'arbitrum'
  | 'stellar'
  | 'stellar-testnet'
  | 'unknown'

const SOLANA_MAINNET_CAIP = 'solana:5eykt4usfv8p8njdtrepy1vzqkqzkvdp'

export function normalizeChain(network: string | null | undefined): Chain {
  if (!network) return 'unknown'
  const n = network.toLowerCase().trim()

  if (n === 'base' || n === 'eip155:8453') return 'base'
  if (n === 'base-sepolia' || n === 'eip155:84532') return 'base-sepolia'
  if (n === 'solana' || n === SOLANA_MAINNET_CAIP || n.startsWith('solana:5eyk')) return 'solana'
  if (n.startsWith('solana:')) return 'solana-devnet'
  if (n === 'ethereum' || n === 'eip155:1') return 'ethereum'
  if (n === 'optimism' || n === 'eip155:10') return 'optimism'
  if (n === 'polygon' || n === 'eip155:137') return 'polygon'
  if (n === 'arbitrum' || n === 'eip155:42161') return 'arbitrum'
  if (n === 'stellar' || n === 'stellar:pubnet') return 'stellar'
  if (n.startsWith('stellar:')) return 'stellar-testnet'
  return 'unknown'
}

export function chainDisplayName(chain: Chain): string {
  switch (chain) {
    case 'base': return 'Base'
    case 'base-sepolia': return 'Base Sepolia'
    case 'solana': return 'Solana'
    case 'solana-devnet': return 'Solana Devnet'
    case 'ethereum': return 'Ethereum'
    case 'optimism': return 'Optimism'
    case 'polygon': return 'Polygon'
    case 'arbitrum': return 'Arbitrum'
    case 'stellar': return 'Stellar'
    case 'stellar-testnet': return 'Stellar Testnet'
    case 'unknown': return 'Unknown'
  }
}

export function isTestnet(chain: Chain): boolean {
  return chain === 'base-sepolia' || chain === 'solana-devnet' || chain === 'stellar-testnet'
}
