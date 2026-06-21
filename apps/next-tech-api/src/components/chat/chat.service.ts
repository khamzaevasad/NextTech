import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiChatInput } from '../../libs/dto/chat/ai-chat.input';

type OpenAiTextPart = {
  type?: string;
  text?: string;
};

type OpenAiOutputItem = {
  content?: OpenAiTextPart[];
};

type OpenAiResponse = {
  output_text?: string;
  output?: OpenAiOutputItem[];
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
};

type OpenAiErrorMeta = {
  status: number;
  code: string;
  type: string;
  message: string;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openAiUrl = 'https://api.openai.com/v1/responses';
  private readonly fallbackModel = 'gpt-4o-mini';
  private readonly provider = 'openai';
  private readonly systemPrompt =
    'You are the AI assistant for the Next-Tech platform. Help users with product discovery, store information, categories, ordering/help flow, account-related general guidance, and platform usage. Keep answers concise, practical, and friendly. If the user needs human assistance, payment/order-specific support, account-specific private information, or admin action, tell them to use the Admin Chat tab.';

  constructor(private readonly configService: ConfigService) {}

  public async askAi(input: AiChatInput): Promise<{ reply: string }> {
    const message = input.message?.trim();
    const apiKey = process.env.OPEN_AI_KEY || this.configService.get<string>('OPEN_AI_KEY');
    const model = process.env.OPENAI_MODEL || this.configService.get<string>('OPENAI_MODEL') || this.fallbackModel;

    this.logInfo('Request received', {
      provider: this.provider,
      messageLength: message?.length || 0,
      hasOpenAiKey: Boolean(apiKey),
      model,
    });

    if (!message) {
      throw new BadRequestException('Message is required');
    }

    if (!apiKey) {
      this.logError('OPEN_AI_KEY is not configured', {
        provider: this.provider,
        hasOpenAiKey: false,
        model,
      });
      throw new ServiceUnavailableException(this.getClientUnavailableMessage());
    }

    try {
      this.logInfo('OpenAI request started', {
        provider: this.provider,
        model,
      });

      const response = await fetch(this.openAiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions: this.systemPrompt,
          input: message,
          max_output_tokens: 350,
          temperature: 0.4,
        }),
      });

      const data = await this.parseOpenAiResponse(response);

      if (!response.ok) {
        this.logOpenAiError(this.getOpenAiErrorMeta(response, data));
        throw new ServiceUnavailableException(this.getClientUnavailableMessage());
      }

      const reply = this.extractReply(data);

      if (!reply) {
        this.logError('OpenAI response did not include reply text', {
          provider: this.provider,
          model,
          replyLength: 0,
        });
        throw new InternalServerErrorException('AI response was empty');
      }

      this.logInfo('OpenAI request succeeded', {
        provider: this.provider,
        model,
        replyLength: reply.length,
      });

      return { reply };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logError('AI chat request failed', {
        provider: this.provider,
        model,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new ServiceUnavailableException(this.getClientUnavailableMessage());
    }
  }

  private getClientUnavailableMessage(): string {
    return 'AI chat is temporarily unavailable. Please try again later or use Admin Chat.';
  }

  private logInfo(message: string, details: Record<string, unknown>): void {
    this.logger.log(`[AI_CHAT] ${message} ${JSON.stringify(details)}`);
  }

  private logError(message: string, details: Record<string, unknown>): void {
    this.logger.error(`[AI_CHAT] ${message} ${JSON.stringify(details)}`);
  }

  private async parseOpenAiResponse(response: Response): Promise<OpenAiResponse> {
    try {
      return (await response.json()) as OpenAiResponse;
    } catch (error) {
      this.logError('OpenAI response parse failed', {
        provider: this.provider,
        status: response.status,
        message: error instanceof Error ? error.message : 'Unknown parse error',
      });
      return {};
    }
  }

  private getOpenAiErrorMeta(response: Response, data: OpenAiResponse): OpenAiErrorMeta {
    return {
      status: response.status,
      code: data.error?.code || 'unknown',
      type: data.error?.type || 'unknown',
      message: data.error?.message || response.statusText || 'Unknown error',
    };
  }

  private logOpenAiError(error: OpenAiErrorMeta): void {
    this.logError('OpenAI API error', {
      provider: this.provider,
      ...error,
    });

    if (error.status === 429 && error.code === 'insufficient_quota') {
      this.logError('OpenAI quota is insufficient. Check billing/credit for the project connected to OPEN_AI_KEY.', {
        provider: this.provider,
        status: error.status,
        code: error.code,
        type: error.type,
      });
    }
  }

  private extractReply(data: OpenAiResponse): string {
    if (data.output_text?.trim()) {
      return data.output_text.trim();
    }

    const text = data.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text?.trim()))
      .join('\n')
      .trim();

    return text || '';
  }
}
