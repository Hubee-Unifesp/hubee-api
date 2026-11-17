import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AnthropicAiService } from './anthropic-ai.service';

@Module({
  providers: [{ provide: AiService, useClass: AnthropicAiService }],
  exports: [AiService],
})
export class AiModule {}
