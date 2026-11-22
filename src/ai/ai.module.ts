import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AnthropicAiService } from './anthropic-ai.service';
import {
  AI_RATE_LIMIT_STORE,
  AiThrottlerGuard,
  createAiRateLimitStoreProvider,
} from './guards/ai-throttler.guard';

@Module({
  providers: [
    { provide: AiService, useClass: AnthropicAiService },
    createAiRateLimitStoreProvider(),
    AiThrottlerGuard,
  ],
  exports: [AiService, AI_RATE_LIMIT_STORE, AiThrottlerGuard],
})
export class AiModule {}
