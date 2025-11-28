import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";

export const sendTelegramDocumentTool = createTool({
  id: "send-telegram-document",
  description: `أداة لإرسال ملف PDF عبر تيليجرام.
  استخدم هذه الأداة بعد إنشاء ملف PDF لإرساله للمستخدم.`,

  inputSchema: z.object({
    chatId: z.number().describe("معرف المحادثة في تيليجرام"),
    pdfPath: z.string().describe("مسار ملف PDF"),
    caption: z.string().optional().describe("رسالة مرفقة مع الملف"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [sendTelegramDocument] Sending document:", context);

    const { chatId, pdfPath, caption } = context;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      logger?.error("❌ [sendTelegramDocument] TELEGRAM_BOT_TOKEN not set");
      return {
        success: false,
        message: "لم يتم تكوين توكن البوت",
      };
    }

    if (!fs.existsSync(pdfPath)) {
      logger?.error("❌ [sendTelegramDocument] PDF file not found:", pdfPath);
      return {
        success: false,
        message: "ملف PDF غير موجود",
      };
    }

    try {
      const fileBuffer = fs.readFileSync(pdfPath);
      const blob = new Blob([fileBuffer], { type: "application/pdf" });
      
      const formData = new FormData();
      formData.append("chat_id", chatId.toString());
      formData.append("document", blob, "استعلام_اللجنة_الانتخابية.pdf");
      if (caption) {
        formData.append("caption", caption);
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendDocument`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (result.ok) {
        logger?.info("✅ [sendTelegramDocument] Document sent successfully");
        return {
          success: true,
          message: "تم إرسال ملف الاستعلام بنجاح",
        };
      } else {
        logger?.error("❌ [sendTelegramDocument] Telegram API error:", result);
        return {
          success: false,
          message: `خطأ في إرسال الملف: ${result.description}`,
        };
      }
    } catch (error) {
      logger?.error("❌ [sendTelegramDocument] Error sending document:", error);
      return {
        success: false,
        message: `حدث خطأ أثناء إرسال الملف: ${error}`,
      };
    }
  },
});
