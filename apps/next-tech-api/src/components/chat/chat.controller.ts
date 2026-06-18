import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiChatInput } from '../../libs/dto/chat/ai-chat.input';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ai')
  public async askAi(@Body() input: AiChatInput): Promise<{ reply: string }> {
    return this.chatService.askAi(input);
  }
}
