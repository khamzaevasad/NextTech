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
    message?: string;
  };
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openAiUrl = 'https://api.openai.com/v1/responses';
  private readonly systemPrompt =
    'You are the AI assistant for the Next-Tech platform. Help users with product discovery, store information, categories, ordering/help flow, account-related general guidance, and platform usage. Keep answers concise, practical, and friendly. If the user needs human assistance, payment/order-specific support, account-specific private information, or admin action, tell them to use the Admin Chat tab.';

  constructor(private readonly configService: ConfigService) {}

  public async askAi(input: AiChatInput): Promise<{ reply: string }> {
    const message = input.message?.trim();

    if (!message) {
      throw new BadRequestException('Message is required');
    }

    const apiKey = this.configService.get<string>('OPEN_AI_KEY');

    if (!apiKey) {
      this.logger.error('OPEN_AI_KEY is not configured');
      throw new ServiceUnavailableException('AI chat is not available right now');
    }

    try {
      const response = await fetch(this.openAiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.configService.get<string>('OPEN_AI_MODEL') || 'gpt-4.1-mini',
          instructions: this.systemPrompt,
          input: message,
          max_output_tokens: 350,
          temperature: 0.4,
        }),
      });

      const data = (await response.json()) as OpenAiResponse;

      if (!response.ok) {
        this.logger.error(`OpenAI API error: ${data.error?.message || response.statusText}`);
        throw new ServiceUnavailableException('AI chat is not available right now');
      }

      const reply = this.extractReply(data);

      if (!reply) {
        this.logger.error('OpenAI response did not include reply text');
        throw new InternalServerErrorException('AI response was empty');
      }

      return { reply };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error('AI chat request failed', error as Error);
      throw new ServiceUnavailableException('AI chat is not available right now');
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
