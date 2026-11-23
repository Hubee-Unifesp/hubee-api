import Anthropic from '@anthropic-ai/sdk';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { AiService, type AiStructuredRequest } from './ai.service';

const UNAVAILABLE_MESSAGE =
  'A geração com IA não está disponível no momento. Tente novamente em instantes.';
const REFUSAL_MESSAGE =
  'Não foi possível gerar uma resposta com IA para esse texto. Reformule e tente novamente.';

@Injectable()
export class AnthropicAiService extends AiService {
  private readonly logger = new Logger(AnthropicAiService.name);
  private client?: Anthropic;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
  }

  async generateStructured({
    system,
    prompt,
    schema,
    maxTokens,
    feature = 'unknown',
  }: AiStructuredRequest): Promise<unknown> {
    const client = this.getClient();
    const model = this.config.get('ANTHROPIC_MODEL', { infer: true });
    const maxTokensCap = this.config.get('AI_MAX_TOKENS', { infer: true });
    const effort = this.config.get('AI_EFFORT', { infer: true });

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: Math.min(maxTokens ?? maxTokensCap, maxTokensCap),
        system: [
          { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: prompt }],
        output_config: {
          effort,
          format: { type: 'json_schema', schema },
        },
      });
    } catch (error) {
      throw this.toHttpError(error);
    }

    const { usage } = response;
    this.logger.log(
      `feature=${feature} model=${response.model} effort=${effort} stop_reason=${response.stop_reason} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens} cache_creation_tokens=${usage.cache_creation_input_tokens ?? 0} cache_read_tokens=${usage.cache_read_input_tokens ?? 0}`,
    );

    if (response.stop_reason === 'refusal') {
      throw new UnprocessableEntityException(REFUSAL_MESSAGE);
    }

    if (response.stop_reason === 'max_tokens') {
      this.logger.warn('Resposta da IA truncada por max_tokens');
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    try {
      return JSON.parse(text) as unknown;
    } catch {
      this.logger.error('Resposta da IA não é um JSON válido');
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  protected createClient(apiKey: string, timeout: number): Anthropic {
    return new Anthropic({ apiKey, timeout, maxRetries: 1 });
  }

  private getClient(): Anthropic {
    if (this.client) return this.client;

    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }

    this.client = this.createClient(
      apiKey,
      this.config.get('AI_TIMEOUT_MS', { infer: true }),
    );
    return this.client;
  }

  private toHttpError(error: unknown): unknown {
    if (!(error instanceof Anthropic.APIError)) return error;

    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      this.logger.warn('Timeout ao chamar o provedor de IA');
    } else if (error instanceof Anthropic.APIConnectionError) {
      this.logger.warn('Falha de conexão com o provedor de IA');
    } else if (error instanceof Anthropic.RateLimitError) {
      this.logger.warn('Limite de requisições do provedor de IA atingido');
    } else {
      this.logger.error(
        `Erro do provedor de IA: status=${error.status} request_id=${error.requestID ?? '-'}`,
      );
    }
    return new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
  }
}
