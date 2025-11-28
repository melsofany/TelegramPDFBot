import { Mastra } from "@mastra/core";
import { MastraError } from "@mastra/core/error";
import { PinoLogger } from "@mastra/loggers";
import { LogLevel, MastraLogger } from "@mastra/core/logger";
import pino from "pino";
import { MCPServer } from "@mastra/mcp";
import { NonRetriableError } from "inngest";
import { z } from "zod";

import { inngest, inngestServe } from "./inngest";

import { electoralAgent } from "./agents/electoralAgent";
import { electoralWorkflow } from "./workflows/electoralWorkflow";
import { registerTelegramTrigger } from "../triggers/telegramTriggers";
import { 
  getConversationState, 
  setSelectedRegion, 
  getCurrentRegion,
  resetConversation 
} from "./agents/conversationState";
import { isCenterSplit, splitCenterPdf } from "./tools/splitPdfBySubcommitteeTool";

class ProductionPinoLogger extends MastraLogger {
  protected logger: pino.Logger;

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
    } = {},
  ) {
    super(options);

    this.logger = pino({
      name: options.name || "app",
      level: options.level || LogLevel.INFO,
      base: {},
      formatters: {
        level: (label: string, _number: number) => ({
          level: label,
        }),
      },
      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    });
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
  }
}

export const mastra = new Mastra({
  workflows: { electoralWorkflow },
  agents: { electoralAgent },
  mcpServers: {
    allTools: new MCPServer({
      name: "allTools",
      version: "1.0.0",
      tools: {},
    }),
  },
  bundler: {
    // A few dependencies are not properly picked up by
    // the bundler if they are not added directly to the
    // entrypoint.
    externals: [
      "@slack/web-api",
      "inngest",
      "inngest/hono",
      "hono",
      "hono/streaming",
    ],
    // sourcemaps are good for debugging.
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    middleware: [
      async (c, next) => {
        const mastra = c.get("mastra");
        const logger = mastra?.getLogger();
        logger?.debug("[Request]", { method: c.req.method, url: c.req.url });
        try {
          await next();
        } catch (error) {
          logger?.error("[Response]", {
            method: c.req.method,
            url: c.req.url,
            error,
          });
          if (error instanceof MastraError) {
            if (error.id === "AGENT_MEMORY_MISSING_RESOURCE_ID") {
              // This is typically a non-retirable error. It means that the request was not
              // setup correctly to pass in the necessary parameters.
              throw new NonRetriableError(error.message, { cause: error });
            }
          } else if (error instanceof z.ZodError) {
            // Validation errors are never retriable.
            throw new NonRetriableError(error.message, { cause: error });
          }

          throw error;
        }
      },
    ],
    apiRoutes: [
      {
        path: "/api/inngest",
        method: "ALL",
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
      },

      ...registerTelegramTrigger({
        triggerType: "telegram/message",
        handler: async (mastra, triggerInfo) => {
          const logger = mastra.getLogger();
          logger?.info("📱 [Telegram Trigger] Received message:", triggerInfo);

          const chatId = triggerInfo.payload.message.chat.id;
          const message = triggerInfo.params.message;

          try {
            logger?.info("🚀 Processing message with agent directly...");
            logger?.info("💬 Chat ID:", chatId);
            
            const regionMap: Record<string, string> = {
              "1": "مركز طما",
              "2": "مركز طهطا", 
              "3": "قسم طهطا",
              "مركز طما": "مركز طما",
              "طما": "مركز طما",
              "مركز طهطا": "مركز طهطا",
              "طهطا": "مركز طهطا",
              "قسم طهطا": "قسم طهطا",
            };

            const normalizedMessage = message.trim();
            const selectedRegion = regionMap[normalizedMessage];
            
            if (selectedRegion) {
              setSelectedRegion(chatId, selectedRegion);
              logger?.info("📍 Region selected:", selectedRegion);
              
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              
              if (!isCenterSplit(selectedRegion)) {
                logger?.info("📂 [Telegram Trigger] Splitting PDF for region:", selectedRegion);
                
                if (botToken) {
                  await fetch(
                    `https://api.telegram.org/bot${botToken}/sendMessage`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: `تم اختيار ${selectedRegion} ✅\n\n⏳ جاري تجهيز الملفات... يرجى الانتظار...`,
                      }),
                    }
                  );
                }
                
                try {
                  const splitResult = await splitCenterPdf(selectedRegion, logger);
                  
                  logger?.info("✅ [Telegram Trigger] Split result:", splitResult);
                  
                  if (botToken) {
                    await fetch(
                      `https://api.telegram.org/bot${botToken}/sendMessage`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          text: `✅ تم تجهيز ${splitResult.chunksCount} جزء.\n\nالرجاء كتابة اسم الشخص الذي تريد البحث عنه:`,
                        }),
                      }
                    );
                  }
                } catch (error) {
                  logger?.error("❌ [Telegram Trigger] Error splitting PDF:", error);
                  if (botToken) {
                    await fetch(
                      `https://api.telegram.org/bot${botToken}/sendMessage`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          text: `تم اختيار ${selectedRegion} ✅\n\nالرجاء كتابة اسم الشخص الذي تريد البحث عنه:`,
                        }),
                      }
                    );
                  }
                }
              } else {
                if (botToken) {
                  await fetch(
                    `https://api.telegram.org/bot${botToken}/sendMessage`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        text: `تم اختيار ${selectedRegion} ✅\n\nالرجاء كتابة اسم الشخص الذي تريد البحث عنه:`,
                      }),
                    }
                  );
                }
              }
              return;
            }

            if (normalizedMessage === "/start" || normalizedMessage === "ابدأ" || normalizedMessage === "بداية") {
              resetConversation(chatId);
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              if (botToken) {
                await fetch(
                  `https://api.telegram.org/bot${botToken}/sendMessage`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `مرحباً بك في خدمة الاستعلام عن اللجان الانتخابية! 🗳️\n\nاختر المنطقة التي تريد البحث فيها:\n1️⃣ مركز طما\n2️⃣ مركز طهطا\n3️⃣ قسم طهطا\n\nأرسل رقم الاختيار أو اسم المنطقة.`,
                    }),
                  }
                );
              }
              return;
            }

            const currentRegion = getCurrentRegion(chatId);
            logger?.info("📍 Current region from state:", currentRegion);
            
            if (!currentRegion) {
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              if (botToken) {
                await fetch(
                  `https://api.telegram.org/bot${botToken}/sendMessage`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `مرحباً بك في خدمة الاستعلام عن اللجان الانتخابية! 🗳️\n\nاختر المنطقة التي تريد البحث فيها:\n1️⃣ مركز طما\n2️⃣ مركز طهطا\n3️⃣ قسم طهطا\n\nأرسل رقم الاختيار أو اسم المنطقة.`,
                    }),
                  }
                );
              }
              return;
            }

            const contextMessage = `المستخدم اختار المنطقة: ${currentRegion}. الآن يريد البحث عن الاسم التالي: ${message}. استخدم أداة البحث للبحث عن هذا الاسم في المنطقة المحددة.`;
            
            logger?.info("📝 Context message:", contextMessage);
            
            const response = await electoralAgent.generate(contextMessage, {
              maxSteps: 10,
            });

            const agentResponse = response.text || "عذراً، لم أتمكن من معالجة طلبك.";
            logger?.info("✅ Agent response:", agentResponse.substring(0, 200));

            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
              const sendResult = await fetch(
                `https://api.telegram.org/bot${botToken}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: agentResponse,
                    parse_mode: "Markdown",
                  }),
                }
              );
              const result = await sendResult.json();
              logger?.info("📨 Message sent:", result);
            }
          } catch (error) {
            logger?.error("❌ Error processing message:", error);
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
              await fetch(
                `https://api.telegram.org/bot${botToken}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: "عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.",
                  }),
                }
              );
            }
          }
        },
      }),
    ],
  },
  logger:
    process.env.NODE_ENV === "production"
      ? new ProductionPinoLogger({
          name: "Mastra",
          level: "info",
        })
      : new PinoLogger({
          name: "Mastra",
          level: "info",
        }),
});

/*  Sanity check 1: Throw an error if there are more than 1 workflows.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getWorkflows()).length > 1) {
  throw new Error(
    "More than 1 workflows found. Currently, more than 1 workflows are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}

/*  Sanity check 2: Throw an error if there are more than 1 agents.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getAgents()).length > 1) {
  throw new Error(
    "More than 1 agents found. Currently, more than 1 agents are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}
