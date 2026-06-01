import type { Crawler, CatalogItem, CrawlerResult } from '../types.js'

const HF_API_URL = 'https://huggingface.co/api/models'

const PIPELINE_TAGS = [
  'text-generation',
  'text-to-image',
  'text-to-video',
  'text-to-speech',
  'automatic-speech-recognition',
  'image-to-text',
  'image-classification',
  'object-detection',
  'image-segmentation',
  'text-to-audio',
  'translation',
  'summarization',
  'feature-extraction',
  'fill-mask',
  'text-classification',
  'question-answering',
  'zero-shot-classification',
  'sentence-similarity',
] as const

interface HFModel {
  _id?: string
  id?: string
  modelId?: string
  likes?: number
  private?: boolean
  downloads?: number
  tags?: string[]
  pipeline_tag?: string
  library_name?: string
  createdAt?: string
}

const CATEGORY_MAP: Record<string, string> = {
  'text-generation': 'ai-inference',
  'text-to-image': 'media',
  'text-to-video': 'media',
  'text-to-speech': 'media',
  'text-to-audio': 'media',
  'automatic-speech-recognition': 'media',
  'image-to-text': 'ai-inference',
  'image-classification': 'ai-inference',
  'object-detection': 'ai-inference',
  'image-segmentation': 'ai-inference',
  'translation': 'ai-inference',
  'summarization': 'ai-inference',
  'feature-extraction': 'ai-inference',
  'fill-mask': 'ai-inference',
  'text-classification': 'ai-inference',
  'question-answering': 'ai-inference',
  'zero-shot-classification': 'ai-inference',
  'sentence-similarity': 'ai-inference',
}

function inferTags(model: HFModel): string[] {
  const tags = ['huggingface']
  if (model.pipeline_tag) tags.push(model.pipeline_tag)
  if (model.library_name) tags.push(model.library_name)

  const modelTags = model.tags ?? []
  if (modelTags.includes('gguf')) tags.push('gguf')
  if (modelTags.includes('safetensors')) tags.push('safetensors')
  if (modelTags.some((t) => t.startsWith('license:'))) tags.push('open-source')

  return tags
}

function slugify(modelId: string): string {
  return `hf:${modelId}`
    .toLowerCase()
    .replace(/[^a-z0-9:._/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

function popularityFromDownloads(downloads: number | undefined): number {
  if (!downloads || downloads <= 0) return 0
  if (downloads >= 10_000_000) return 100
  if (downloads >= 1_000_000) return 90
  if (downloads >= 100_000) return 75
  if (downloads >= 10_000) return 60
  if (downloads >= 1_000) return 40
  if (downloads >= 100) return 20
  return 10
}

function displayName(modelId: string): string {
  const parts = modelId.split('/')
  if (parts.length === 2) return modelId
  return parts.pop() ?? modelId
}

async function fetchTag(pipelineTag: string): Promise<{ models: HFModel[]; error?: string }> {
  const url = new URL(HF_API_URL)
  url.searchParams.set('pipeline_tag', pipelineTag)
  url.searchParams.set('sort', 'downloads')
  url.searchParams.set('direction', '-1')
  url.searchParams.set('limit', '50')

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return { models: [], error: `HTTP ${res.status} for ${pipelineTag}` }
    }

    const batch = (await res.json()) as HFModel[]
    if (!Array.isArray(batch)) return { models: [] }
    return { models: batch }
  } catch (err) {
    return { models: [], error: err instanceof Error ? err.message : String(err) }
  }
}

export const huggingfaceCrawler: Crawler = {
  source: 'huggingface',
  description: 'Hugging Face Hub — open-source ML model repository with inference endpoints',
  async run(): Promise<CrawlerResult> {
    const items: CatalogItem[] = []
    const seen = new Set<string>()
    const errors: string[] = []

    try {
      const results = await Promise.all(PIPELINE_TAGS.map(fetchTag))

      for (let i = 0; i < results.length; i++) {
        const { models, error } = results[i]!
        if (error) errors.push(error)

        for (const model of models) {
          const modelId = model.id ?? model.modelId
          if (!modelId) continue
          if (model.private) continue
          if (seen.has(modelId)) continue
          seen.add(modelId)

          const category = CATEGORY_MAP[model.pipeline_tag ?? ''] ?? 'ai-inference'
          const endpointUrl = `https://api-inference.huggingface.co/models/${modelId}`
          const websiteUrl = `https://huggingface.co/${modelId}`

          items.push({
            sourceId: modelId,
            slug: slugify(modelId),
            name: displayName(modelId),
            description: `${model.pipeline_tag ?? 'ML'} model on Hugging Face (${(model.downloads ?? 0).toLocaleString()} downloads)`.slice(0, 500),
            category,
            endpointUrl,
            websiteUrl,
            protocol: 'http',
            protocols: ['http'],
            pricePerQuery: null,
            priceCurrency: 'USD',
            tags: inferTags(model),
            metadata: {
              pipelineTag: model.pipeline_tag,
              libraryName: model.library_name,
              downloads: model.downloads,
              likes: model.likes,
            },
            popularity: popularityFromDownloads(model.downloads),
            verified: true,
            healthStatus: 'reachable',
          })
        }
      }

      const errorMessage = errors.length > 0 ? errors.join('; ') : undefined
      return { source: 'huggingface', items, errorMessage }
    } catch (err) {
      return {
        source: 'huggingface',
        items,
        errorMessage: err instanceof Error ? err.message : String(err),
      }
    }
  },
}
