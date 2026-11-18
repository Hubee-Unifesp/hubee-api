import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { AnthropicAiService } from './anthropic-ai.service';

type CreateFn = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>;

const create = jest.fn<CreateFn>();
const createClient = jest.fn<(apiKey: string, timeout: number) => void>();

class TestAnthropicAiService extends AnthropicAiService {
  protected createClient(apiKey: string, timeout: number): Anthropic {
    createClient(apiKey, timeout);
    return { messages: { create } } as unknown as Anthropic;
  }
}

const ENV: Partial<EnvironmentVariables> = {
  ANTHROPIC_API_KEY: 'sk-ant-test',
  ANTHROPIC_MODEL: 'claude-opus-5-5',
  AI_TIMEOUT_MS: 30000,
};

function makeService(env: Partial<EnvironmentVariables> = ENV) {
  return new TestAnthropicAiService({
    get: (key: keyof EnvironmentVariables) => env[key],
  } as unknown as ConfigService<EnvironmentVariables, true>);
}

function makeMessage(
  text: string,
  stopReason: Anthropic.StopReason = 'end_turn',
): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
    },
  } as unknown as Anthropic.Message;
}

const REQUEST = {
  system: 'Extraia os dados do evento.',
  prompt: 'Show de rock no sábado',
  schema: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    additionalProperties: false,
  },
};

describe('AnthropicAiService', () => {
  beforeEach(() => {
    create.mockReset();
    createClient.mockReset();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('envia prompt com saída estruturada e devolve o JSON interpretado', async () => {
    create.mockResolvedValue(makeMessage('{"name":"Show de rock"}'));

    const result = await makeService().generateStructured(REQUEST);

    expect(result).toEqual({ name: 'Show de rock' });
    expect(createClient).toHaveBeenCalledWith('sk-ant-test', 30000);
    expect(create).toHaveBeenCalledWith({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system: [
        {
          type: 'text',
          text: REQUEST.system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: REQUEST.prompt }],
      output_config: {
        format: { type: 'json_schema', schema: REQUEST.schema },
      },
    });
  });

  it('respeita maxTokens informado', async () => {
    create.mockResolvedValue(makeMessage('{"name":"x"}'));

    await makeService().generateStructured({ ...REQUEST, maxTokens: 2000 });

    expect(create.mock.calls[0][0].max_tokens).toBe(2000);
  });

  it('reaproveita o mesmo cliente entre chamadas', async () => {
    create.mockResolvedValue(makeMessage('{"name":"x"}'));
    const service = makeService();

    await service.generateStructured(REQUEST);
    await service.generateStructured(REQUEST);

    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('responde 503 sem chamar o provedor quando não há chave', async () => {
    await expect(
      makeService({ ...ENV, ANTHROPIC_API_KEY: undefined }).generateStructured(
        REQUEST,
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ['timeout', new Anthropic.APIConnectionTimeoutError()],
    ['falha de conexão', new Anthropic.APIConnectionError({ message: 'x' })],
    [
      'rate limit',
      new Anthropic.RateLimitError(429, {}, 'limite', new Headers()),
    ],
    [
      'erro interno',
      new Anthropic.InternalServerError(500, {}, 'erro', new Headers()),
    ],
    [
      'chave inválida',
      new Anthropic.AuthenticationError(401, {}, 'chave', new Headers()),
    ],
  ])('converte %s do provedor em 503', async (_, error) => {
    create.mockRejectedValue(error);

    await expect(makeService().generateStructured(REQUEST)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('propaga erros que não vêm do provedor', async () => {
    const error = new TypeError('bug');
    create.mockRejectedValue(error);

    await expect(makeService().generateStructured(REQUEST)).rejects.toBe(error);
  });

  it('responde 422 quando a IA recusa o pedido', async () => {
    create.mockResolvedValue(makeMessage('', 'refusal'));

    await expect(makeService().generateStructured(REQUEST)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('responde 503 quando a resposta é truncada por max_tokens', async () => {
    create.mockResolvedValue(makeMessage('{"name":', 'max_tokens'));

    await expect(makeService().generateStructured(REQUEST)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('responde 503 quando a resposta não é JSON válido', async () => {
    create.mockResolvedValue(makeMessage('não é json'));

    await expect(makeService().generateStructured(REQUEST)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
