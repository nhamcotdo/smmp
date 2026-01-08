import { ContentType } from '@/database/entities/enums'
import { Post } from '@/database/entities'
import { IPostPublishingStrategy } from './IPostPublishingStrategy'
import { TextPostPublishingStrategy } from './TextPostPublishingStrategy'
import { ImagePostPublishingStrategy } from './ImagePostPublishingStrategy'
import { VideoPostPublishingStrategy } from './VideoPostPublishingStrategy'
import { CarouselPostPublishingStrategy } from './CarouselPostPublishingStrategy'

export class PostPublishingStrategyRegistry {
  private strategies: Map<ContentType, IPostPublishingStrategy>

  constructor(strategies: IPostPublishingStrategy[]) {
    this.strategies = new Map(
      strategies.map((s) => [s.contentType, s])
    )
  }

  getStrategy(post: Post): IPostPublishingStrategy {
    const strategy = this.strategies.get(post.contentType as ContentType)
    if (!strategy) {
      throw new Error(`No publishing strategy for content type: ${post.contentType}`)
    }
    return strategy
  }

  getStrategyByContentType(contentType: ContentType): IPostPublishingStrategy {
    const strategy = this.strategies.get(contentType)
    if (!strategy) {
      throw new Error(`No publishing strategy for content type: ${contentType}`)
    }
    return strategy
  }
}

export function createDefaultStrategyRegistry(): PostPublishingStrategyRegistry {
  return new PostPublishingStrategyRegistry([
    new TextPostPublishingStrategy(),
    new ImagePostPublishingStrategy(),
    new VideoPostPublishingStrategy(),
    new CarouselPostPublishingStrategy(),
  ])
}
