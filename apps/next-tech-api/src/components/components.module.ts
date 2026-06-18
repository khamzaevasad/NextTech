import { Module } from '@nestjs/common';
import { MemberModule } from './member/member.module';
import { FollowModule } from './follow/follow.module';
import { AuthModule } from './auth/auth.module';
import { BoardArticleModule } from './board-article/board-article.module';
import { LikeModule } from './like/like.module';
import { ViewModule } from './view/view.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { StoreModule } from './store/store.module';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { NoticeModule } from './notice/notice.module';
import { FaqModule } from './faq/faq.module';
import { TelegramModule } from './telegram/telegram.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    MemberModule,
    FollowModule,
    AuthModule,
    BoardArticleModule,
    LikeModule,
    ViewModule,
    ProductModule,
    OrderModule,
    StoreModule,
    CategoryModule,
    CommentModule,
    NoticeModule,
    FaqModule,
    TelegramModule,
    ChatModule,
  ],
})
export class ComponentsModule {}
