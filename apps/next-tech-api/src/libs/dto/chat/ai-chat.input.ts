import { IsString, MaxLength, MinLength } from 'class-validator';

export class AiChatInput {
  @IsString()
  @MinLength(1)
  @MaxLength(1200)
  message: string;
}
