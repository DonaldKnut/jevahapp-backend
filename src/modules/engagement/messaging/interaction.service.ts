import { Types, ClientSession } from "mongoose";
import { Interaction } from "../../../models/interaction.model";
import { Media } from "../../../models/media.model";
import * as messageService from "./message.service";
import * as conversationService from "./conversation.service";

export type { MessageInput } from "./message.service";

export interface ReactionInput {
  userId: string;
  commentId: string;
  reactionType: string;
}

export class InteractionService {
  async addCommentReaction(
    data: ReactionInput
  ): Promise<{ reactionType: string; count: number }> {
    if (
      !Types.ObjectId.isValid(data.userId) ||
      !Types.ObjectId.isValid(data.commentId)
    ) {
      throw new Error("Invalid user or comment ID");
    }

    const comment = await Interaction.findById(data.commentId);
    if (!comment || comment.interactionType !== "comment") {
      throw new Error("Comment not found");
    }

    const session: ClientSession = await Media.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const userId = new Types.ObjectId(data.userId);
        const currentReactions: any = (comment.reactions as any) || {};
        const existing = Array.isArray(currentReactions[data.reactionType])
          ? currentReactions[data.reactionType]
          : [];

        const hasReacted = existing.some((id: any) => id.equals(userId));
        const updatedArray = hasReacted
          ? existing.filter((id: any) => !id.equals(userId))
          : [...existing, userId];

        await Interaction.findByIdAndUpdate(
          data.commentId,
          { [`reactions.${data.reactionType}`]: updatedArray },
          { new: false, session }
        );

        return {
          reactionType: data.reactionType,
          count: updatedArray.length,
        };
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  sendMessage = messageService.sendMessage;
  getConversationMessages = conversationService.getConversationMessages;
  getUserConversations = conversationService.getUserConversations;
  deleteMessage = messageService.deleteMessage;
}

export default new InteractionService();
