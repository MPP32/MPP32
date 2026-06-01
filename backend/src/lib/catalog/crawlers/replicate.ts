import type { Crawler, CatalogItem, CrawlerResult } from '../types.js'

const REPLICATE_API_URL = 'https://api.replicate.com/v1/models'

interface ReplicateModel {
  url?: string
  owner?: string
  name?: string
  description?: string
  visibility?: string
  github_url?: string | null
  paper_url?: string | null
  license_url?: string | null
  run_count?: number
  cover_image_url?: string | null
  default_example?: {
    completed_at?: string
    created_at?: string
    model?: string
    status?: string
  } | null
  latest_version?: {
    id?: string
    created_at?: string
    openapi_schema?: Record<string, unknown>
  } | null
}

interface ReplicateResponse {
  results?: ReplicateModel[]
  next?: string | null
  previous?: string | null
}

function inferCategory(model: ReplicateModel): string {
  const blob = `${model.owner ?? ''} ${model.name ?? ''} ${model.description ?? ''}`.toLowerCase()
  if (/(text-to-image|image.generat|diffusion|flux|sdxl|stable.?diffusion|midjourney|dall)/.test(blob)) return 'media'
  if (/(text-to-video|video.generat|animate|wan|kling)/.test(blob)) return 'media'
  if (/(text-to-speech|tts|voice.clone|speech.synth|bark|tortoise)/.test(blob)) return 'media'
  if (/(speech-to-text|whisper|transcri|asr)/.test(blob)) return 'media'
  if (/(text-to-music|music.generat|audio.generat|musicgen)/.test(blob)) return 'media'
  if (/(llm|language.model|chat|instruct|llama|mistral|gemma|qwen|phi-|gpt)/.test(blob)) return 'ai-inference'
  if (/(embed|vector|retriev|rag|rerank)/.test(blob)) return 'ai-inference'
  if (/(image-to-text|caption|ocr|vision|moondream)/.test(blob)) return 'ai-inference'
  if (/(upscal|super.?res|restore|enhance|esrgan|real-esrgan)/.test(blob)) return 'media'
  if (/(segment|detect|object.detect|yolo|sam|grounding)/.test(blob)) return 'ai-inference'
  if (/(remove.?bg|background.?remov|rembg)/.test(blob)) return 'media'
  if (/(3d|mesh|point.cloud|nerf|gaussian.splat)/.test(blob)) return 'media'
  if (/(code|program|copilot|codellama)/.test(blob)) return 'ai-inference'
  return 'ai-inference'
}

function inferTags(model: ReplicateModel): string[] {
  const tags = ['replicate']
  const blob = `${model.name ?? ''} ${model.description ?? ''}`.toLowerCase()

  if (/diffusion|flux|sdxl|dalle|image.gen/.test(blob)) tags.push('image-generation')
  if (/llm|language.model|chat|llama|mistral/.test(blob)) tags.push('llm')
  if (/video/.test(blob)) tags.push('video')
  if (/audio|music|speech|tts|whisper/.test(blob)) tags.push('audio')
  if (/vision|ocr|caption/.test(blob)) tags.push('vision')
  if (/embed|vector/.test(blob)) tags.push('embeddings')
  if (/upscal|enhance|restore/.test(blob)) tags.push('upscaling')
  if (/segment|detect/.test(blob)) tags.push('detection')
  if (/3d|mesh|nerf/.test(blob)) tags.push('3d')
  if (/code|program/.test(blob)) tags.push('code')
  if (model.github_url) tags.push('open-source')

  return tags
}

function slugify(owner: string, name: string): string {
  return `replicate:${owner}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

function popularityFromRuns(runCount: number | undefined): number {
  if (!runCount || runCount <= 0) return 0
  if (runCount >= 10_000_000) return 100
  if (runCount >= 1_000_000) return 90
  if (runCount >= 100_000) return 75
  if (runCount >= 10_000) return 60
  if (runCount >= 1_000) return 40
  if (runCount >= 100) return 20
  return 10
}

export const replicateCrawler: Crawler = {
  source: 'replicate',
  description: 'Replicate — cloud ML inference marketplace with thousands of open-source models',
  async run(): Promise<CrawlerResult> {
    const token = process.env.REPLICATE_API_TOKEN
    if (!token) {
      return {
        source: 'replicate',
        items: [],
        errorMessage: 'REPLICATE_API_TOKEN not set — skipping',
      }
    }

    const items: CatalogItem[] = []
    const seen = new Set<string>()
    let nextUrl: string | null = REPLICATE_API_URL

    try {
      for (let page = 0; page < 30 && nextUrl; page++) {
        const res = await fetch(nextUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          if (page === 0) {
            return {
              source: 'replicate',
              items: [],
              errorMessage: `Replicate HTTP ${res.status}`,
            }
          }
          break
        }

        const data = (await res.json()) as ReplicateResponse
        const batch = data.results ?? []
        if (batch.length === 0) break

        for (const model of batch) {
          if (!model.owner || !model.name) continue
          if (model.visibility !== 'public') continue

          const sourceId = `${model.owner}/${model.name}`
          if (seen.has(sourceId)) continue
          seen.add(sourceId)

          const endpointUrl = `https://api.replicate.com/v1/models/${sourceId}/predictions`
          const websiteUrl = model.url ?? `https://replicate.com/${sourceId}`

          items.push({
            sourceId,
            slug: slugify(model.owner, model.name),
            name: `${model.owner}/${model.name}`,
            description: (model.description ?? `Replicate model: ${sourceId}`).slice(0, 500),
            category: inferCategory(model),
            endpointUrl,
            websiteUrl,
            protocol: 'http',
            protocols: ['http'],
            pricePerQuery: null,
            priceCurrency: 'USD',
            tags: inferTags(model),
            metadata: {
              owner: model.owner,
              runCount: model.run_count,
              latestVersionId: model.latest_version?.id,
              githubUrl: model.github_url,
              paperUrl: model.paper_url,
            },
            iconUrl: model.cover_image_url ?? null,
            popularity: popularityFromRuns(model.run_count),
            verified: true,
            healthStatus: 'reachable',
          })
        }

        nextUrl = data.next ?? null
      }

      return { source: 'replicate', items }
    } catch (err) {
      return {
        source: 'replicate',
        items,
        errorMessage: err instanceof Error ? err.message : String(err),
      }
    }
  },
}
