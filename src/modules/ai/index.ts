/**
 * AI module: chatbot, re-engagement
 */
import { Router } from "express";
import aiChatbotRoutes from "../../routes/aiChatbot.routes";
import aiReengagementRoutes from "../../routes/aiReengagement.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/ai-chatbot", router: aiChatbotRoutes },
  { path: "/api/ai-reengagement", router: aiReengagementRoutes },
];

export default { mounts };
