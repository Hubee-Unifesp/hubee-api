export interface AiStructuredRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  feature?: string;
}

export abstract class AiService {
  abstract generateStructured(request: AiStructuredRequest): Promise<unknown>;
}
