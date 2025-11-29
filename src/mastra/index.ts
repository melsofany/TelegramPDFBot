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
import { registerApiRoute } from "./inngest";
import { 
  getConversationState, 
  setSelectedRegion, 
  setNationalId,
  setSubcommitteeNumber,
  setVoterNumber,
  setPollingStation,
  confirmData,
  getCurrentRegion,
  getCurrentStep,
  getVoterData,
  resetConversation,
  isValidNationalId,
  isValidNumber
} from "./agents/conversationState";
import { generateElectoralInquiryPdf } from "./tools/generateElectoralPdfTool";
import { generateElectoralInquiryHtml } from "./tools/generateElectoralHtmlTool";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn(
    "Trying to initialize Telegram triggers without TELEGRAM_BOT_TOKEN. Can you confirm that the Telegram integration is configured correctly?",
  );
}

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

async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup?: any) {
  const body: any = {
    chat_id: chatId,
    text: text,
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

async function sendTelegramDocument(botToken: string, chatId: number, pdfBuffer: Buffer, fileName: string, caption?: string) {
  const uint8Array = new Uint8Array(pdfBuffer);
  const blob = new Blob([uint8Array], { type: "application/pdf" });
  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append("document", blob, fileName);
  if (caption) {
    formData.append("caption", caption);
  }
  await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    {
      method: "POST",
      body: formData,
    }
  );
}

async function handleTelegramMessage(mastra: Mastra, chatId: number, message: string) {
  const logger = mastra.getLogger();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    logger?.error("❌ TELEGRAM_BOT_TOKEN not set");
    return;
  }

  try {
    logger?.info("🚀 Processing message...");
    logger?.info("💬 Chat ID:", chatId);
    logger?.info("📝 Message:", message);

    if (message === "/start" || message === "ابدأ" || message === "بداية") {
      resetConversation(chatId);
      await sendTelegramMessage(
        botToken,
        chatId,
        `مرحباً بك في خدمة الاستعلام عن اللجان الانتخابية! 🗳️\n\nاختر المركز:\n1️⃣ مركز طما\n2️⃣ مركز طهطا\n3️⃣ قسم طهطا\n\nأرسل رقم الاختيار أو اسم المركز.`
      );
      return;
    }

    const currentStep = getCurrentStep(chatId);
    logger?.info("📍 Current step:", currentStep);

    if (currentStep === 'select_region') {
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

      const selectedRegion = regionMap[message];
      
      if (selectedRegion) {
        setSelectedRegion(chatId, selectedRegion);
        logger?.info("📍 Region selected:", selectedRegion);
        
        await sendTelegramMessage(
          botToken,
          chatId,
          `تم اختيار ${selectedRegion} ✅\n\n📝 الرجاء إدخال الرقم القومي (14 رقم):`
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          `⚠️ اختيار غير صحيح.\n\nالرجاء اختيار المركز:\n1️⃣ مركز طما\n2️⃣ مركز طهطا\n3️⃣ قسم طهطا`
        );
      }
      return;
    }

    if (currentStep === 'enter_national_id') {
      const cleanedId = message.replace(/\s/g, '');
      
      if (!isValidNationalId(cleanedId)) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `⚠️ الرقم القومي يجب أن يكون 14 رقم.\n\nالرجاء إدخال الرقم القومي بشكل صحيح:`
        );
        return;
      }
      
      setNationalId(chatId, cleanedId);
      logger?.info("🆔 National ID set:", cleanedId);
      
      await sendTelegramMessage(
        botToken,
        chatId,
        `✅ تم تسجيل الرقم القومي.\n\n📝 الرجاء إدخال رقم اللجنة الفرعية:`
      );
      return;
    }

    if (currentStep === 'enter_subcommittee') {
      const cleanedNum = message.replace(/\s/g, '');
      
      if (!isValidNumber(cleanedNum)) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `⚠️ رقم اللجنة الفرعية يجب أن يكون أرقام فقط.\n\nالرجاء إدخال رقم اللجنة الفرعية:`
        );
        return;
      }
      
      setSubcommitteeNumber(chatId, cleanedNum);
      logger?.info("📋 Subcommittee number set:", cleanedNum);
      
      await sendTelegramMessage(
        botToken,
        chatId,
        `✅ تم تسجيل رقم اللجنة الفرعية.\n\n📝 الرجاء إدخال رقمك في كشوف الناخبين:`
      );
      return;
    }

    if (currentStep === 'enter_voter_number') {
      const cleanedNum = message.replace(/\s/g, '');
      
      if (!isValidNumber(cleanedNum)) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `⚠️ رقمك في الكشوف يجب أن يكون أرقام فقط.\n\nالرجاء إدخال رقمك في كشوف الناخبين:`
        );
        return;
      }
      
      setVoterNumber(chatId, cleanedNum);
      logger?.info("📊 Voter number set:", cleanedNum);
      
      await sendTelegramMessage(
        botToken,
        chatId,
        `✅ تم تسجيل رقمك في الكشوف.\n\n📝 الرجاء إدخال اسم مركزك الانتخابي:`
      );
      return;
    }

    if (currentStep === 'enter_polling_station') {
      if (message.length < 3) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `⚠️ اسم المركز الانتخابي قصير جداً.\n\nالرجاء إدخال اسم مركزك الانتخابي:`
        );
        return;
      }
      
      setPollingStation(chatId, message);
      logger?.info("🏢 Polling station set:", message);
      
      const voterData = getVoterData(chatId);
      const currentRegion = getCurrentRegion(chatId);
      
      const reviewMessage = `📋 مراجعة البيانات:\n\n` +
        `🏛️ المركز: ${currentRegion}\n` +
        `🆔 الرقم القومي: ${voterData.nationalId}\n` +
        `📋 رقم اللجنة الفرعية: ${voterData.subcommitteeNumber}\n` +
        `📊 رقمك في الكشوف: ${voterData.voterNumber}\n` +
        `🏢 المركز الانتخابي: ${voterData.pollingStation}\n\n` +
        `هل البيانات صحيحة؟`;
      
      await sendTelegramMessage(
        botToken,
        chatId,
        reviewMessage,
        {
          inline_keyboard: [
            [
              { text: "✅ تأكيد", callback_data: "confirm_data" },
              { text: "❌ إلغاء وبدء من جديد", callback_data: "cancel_data" }
            ]
          ]
        }
      );
      return;
    }

    if (currentStep === 'review_data') {
      if (message === "تأكيد" || message === "نعم" || message === "confirm") {
        await generateAndSendPdf(mastra, chatId);
      } else if (message === "إلغاء" || message === "لا" || message === "cancel") {
        resetConversation(chatId);
        await sendTelegramMessage(
          botToken,
          chatId,
          `تم الإلغاء.\n\nللبدء من جديد، أرسل /start`
        );
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          `الرجاء الضغط على زر "تأكيد" أو "إلغاء"`
        );
      }
      return;
    }

    await sendTelegramMessage(
      botToken,
      chatId,
      `للبدء، أرسل /start`
    );

  } catch (error) {
    logger?.error("❌ Error processing message:", error);
    if (botToken) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى."
      );
    }
  }
}

async function generateAndSendPdf(mastra: Mastra, chatId: number) {
  const logger = mastra.getLogger();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) return;

  confirmData(chatId);
  const voterData = getVoterData(chatId);
  const currentRegion = getCurrentRegion(chatId);
  
  await sendTelegramMessage(botToken, chatId, "⏳ جاري إنشاء ملف الاستعلام...");
  
  try {
    const htmlResult = await generateElectoralInquiryHtml({
      nationalId: voterData.nationalId || "",
      pollingStation: voterData.pollingStation || "",
      governorate: "سوهاج",
      center: currentRegion || "",
      address: "شارع الجمهورية بجوار سنترال جهينة الغربية",
      subcommitteeNumber: voterData.subcommitteeNumber || "",
      voterNumber: voterData.voterNumber || "",
      votingDate: "10 - 11 نوفمبر",
      attendanceDensity: "متاحة على التطبيق ايام الاقتراع",
      individualCircle: "طهطا",
      listCircle: "دائرة قطاع شمال ووسط وجنوب الصعيد",
    });
    
    if (htmlResult.success) {
      const fileBuffer = Buffer.from(htmlResult.htmlContent, 'utf-8');
      await sendTelegramDocument(
        botToken,
        chatId,
        fileBuffer,
        `استعلام_${voterData.nationalId}.html`,
        "✅ تم إنشاء ملف الاستعلام بنجاح"
      );
    } else {
      await sendTelegramMessage(botToken, chatId, "❌ حدث خطأ أثناء إنشاء الملف");
    }
  } catch (error) {
    logger?.error("❌ Error generating HTML:", error);
    await sendTelegramMessage(botToken, chatId, "❌ حدث خطأ أثناء إنشاء الملف");
  }
  
  resetConversation(chatId);
  await sendTelegramMessage(
    botToken,
    chatId,
    `للاستعلام مرة أخرى، أرسل /start`
  );
}

async function handleTelegramCallback(mastra: Mastra, chatId: number, callbackData: string, callbackQueryId: string) {
  const logger = mastra.getLogger();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    logger?.error("❌ TELEGRAM_BOT_TOKEN not set");
    return;
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      }
    );

    if (callbackData === "confirm_data") {
      await generateAndSendPdf(mastra, chatId);
    } else if (callbackData === "cancel_data") {
      resetConversation(chatId);
      await sendTelegramMessage(
        botToken,
        chatId,
        `تم الإلغاء.\n\nللبدء من جديد، أرسل /start`
      );
    }
  } catch (error) {
    logger?.error("❌ Error handling callback:", error);
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
    externals: [
      "@slack/web-api",
      "inngest",
      "inngest/hono",
      "hono",
      "hono/streaming",
    ],
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
              throw new NonRetriableError(error.message, { cause: error });
            }
          } else if (error instanceof z.ZodError) {
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

      registerApiRoute("/webhooks/telegram/action", {
        method: "POST",
        handler: async (c) => {
          const mastra = c.get("mastra");
          const logger = mastra.getLogger();
          try {
            const payload = await c.req.json();
            logger?.info("📱 [Telegram] payload", payload);

            if (payload.message) {
              const chatId = payload.message.chat.id;
              const message = payload.message.text?.trim() || "";
              await handleTelegramMessage(mastra, chatId, message);
            } else if (payload.callback_query) {
              const chatId = payload.callback_query.message?.chat?.id;
              const callbackData = payload.callback_query.data;
              const callbackQueryId = payload.callback_query.id;
              if (chatId) {
                await handleTelegramCallback(mastra, chatId, callbackData, callbackQueryId);
              }
            }

            return c.text("OK", 200);
          } catch (error) {
            logger?.error("Error handling Telegram webhook:", error);
            return c.text("Internal Server Error", 500);
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
