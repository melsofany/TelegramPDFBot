import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { electoralAgent } from "../agents/electoralAgent";

const processWithAgent = createStep({
  id: "process-with-agent",
  description: "يعالج رسالة المستخدم باستخدام الوكيل الذكي للاستعلام عن اللجان الانتخابية",

  inputSchema: z.object({
    message: z.string().describe("رسالة المستخدم"),
    chatId: z.number().describe("معرف المحادثة في تيليجرام"),
    userName: z.string().optional().describe("اسم المستخدم في تيليجرام"),
  }),

  outputSchema: z.object({
    agentResponse: z.string(),
    chatId: z.number(),
    pdfPath: z.string().optional(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🚀 [Step 1] Processing message with electoral agent...");
    logger?.info("📝 [Step 1] Input data:", inputData);

    const response = await electoralAgent.generate(inputData.message, {
      maxSteps: 10,
    });

    logger?.info("✅ [Step 1] Agent response received:", response.text?.substring(0, 200));

    let pdfPath: string | undefined;
    if (response.toolResults) {
      for (const result of response.toolResults) {
        if (result && typeof result === 'object' && 'pdfPath' in result) {
          pdfPath = result.pdfPath as string;
          break;
        }
      }
    }

    return {
      agentResponse: response.text || "عذراً، لم أتمكن من معالجة طلبك.",
      chatId: inputData.chatId,
      pdfPath,
    };
  },
});

const sendTelegramResponse = createStep({
  id: "send-telegram-response",
  description: "يرسل رد الوكيل إلى المستخدم عبر تيليجرام",

  inputSchema: z.object({
    agentResponse: z.string(),
    chatId: z.number(),
    pdfPath: z.string().optional(),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [Step 2] Sending response to Telegram...");
    logger?.info("📝 [Step 2] Chat ID:", inputData.chatId);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger?.error("❌ [Step 2] TELEGRAM_BOT_TOKEN not set");
      return {
        success: false,
        message: "Bot token not configured",
      };
    }

    try {
      const sendMessageResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: inputData.chatId,
            text: inputData.agentResponse,
            parse_mode: "Markdown",
          }),
        }
      );

      const messageResult = await sendMessageResponse.json();
      logger?.info("📨 [Step 2] Message sent result:", messageResult);

      if (inputData.pdfPath) {
        logger?.info("📎 [Step 2] Sending PDF document:", inputData.pdfPath);
        
        const fs = await import("fs");
        if (fs.existsSync(inputData.pdfPath)) {
          const fileBuffer = fs.readFileSync(inputData.pdfPath);
          const blob = new Blob([fileBuffer], { type: "application/pdf" });
          
          const formData = new FormData();
          formData.append("chat_id", inputData.chatId.toString());
          formData.append("document", blob, "استعلام_اللجنة_الانتخابية.pdf");
          formData.append("caption", "📄 ملف الاستعلام عن اللجنة الانتخابية");

          const docResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/sendDocument`,
            {
              method: "POST",
              body: formData,
            }
          );

          const docResult = await docResponse.json();
          logger?.info("📄 [Step 2] Document sent result:", docResult);
        }
      }

      logger?.info("✅ [Step 2] Response sent successfully");
      return {
        success: true,
        message: "Response sent successfully",
      };
    } catch (error) {
      logger?.error("❌ [Step 2] Error sending response:", error);
      return {
        success: false,
        message: `Error: ${error}`,
      };
    }
  },
});

export const electoralWorkflow = createWorkflow({
  id: "electoral-inquiry-workflow",

  inputSchema: z.object({
    message: z.string().describe("رسالة المستخدم"),
    chatId: z.number().describe("معرف المحادثة في تيليجرام"),
    userName: z.string().optional().describe("اسم المستخدم"),
  }) as any,

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(processWithAgent as any)
  .then(sendTelegramResponse as any)
  .commit();
