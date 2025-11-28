import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs";
import * as path from "path";

function reverseArabicText(text: string): string {
  return text.split('').reverse().join('');
}

export const generateElectoralPdfTool = createTool({
  id: "generate-electoral-pdf",
  description: `أداة لإنشاء ملف PDF يحتوي على بيانات اللجنة الانتخابية بالتنسيق الرسمي.
  استخدم هذه الأداة بعد العثور على بيانات الناخب وبعد التحقق من الرقم القومي.`,

  inputSchema: z.object({
    nationalId: z.string().describe("الرقم القومي للناخب"),
    name: z.string().describe("اسم الناخب"),
    pollingStation: z.string().describe("مركز الانتخاب"),
    governorate: z.string().describe("المحافظة"),
    center: z.string().describe("المركز"),
    address: z.string().describe("العنوان"),
    subcommitteeNumber: z.string().describe("رقم اللجنة الفرعية"),
    voterNumber: z.string().describe("رقم الناخب في الكشوف"),
    votingDate: z.string().describe("تاريخ التصويت"),
    attendanceDensity: z.string().describe("كثافة الحضور"),
    individualCircle: z.string().describe("دائرة الفردي"),
    listCircle: z.string().describe("دائرة القائمة"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    pdfPath: z.string(),
    pdfBase64: z.string(),
    message: z.string(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📄 [generateElectoralPdf] Creating PDF with data:", context);

    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawText("Electoral Committee Inquiry", {
        x: width / 2 - 100,
        y: height - 50,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      page.drawText("خدمة الاستعلام عن اللجان الانتخابية", {
        x: width / 2 - 80,
        y: height - 75,
        size: 14,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawLine({
        start: { x: 50, y: height - 90 },
        end: { x: width - 50, y: height - 90 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      const nationalIdText = `National ID: ${context.nationalId}`;
      page.drawText(nationalIdText, {
        x: 50,
        y: height - 120,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      page.drawText("له حق الانتخاب", {
        x: width - 150,
        y: height - 120,
        size: 12,
        font: font,
        color: rgb(0, 0.5, 0),
      });

      page.drawRectangle({
        x: 40,
        y: height - 500,
        width: width - 80,
        height: 360,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      page.drawText("Electoral Committee Data", {
        x: width / 2 - 70,
        y: height - 160,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      const fields = [
        { label: "Polling Station", value: context.pollingStation, labelAr: "مركز الانتخاب" },
        { label: "Governorate", value: context.governorate, labelAr: "المحافظة" },
        { label: "Center", value: context.center, labelAr: "المركز" },
        { label: "Address", value: context.address, labelAr: "العنوان" },
        { label: "Subcommittee No.", value: context.subcommitteeNumber, labelAr: "رقم اللجنة الفرعية" },
        { label: "Voter No.", value: context.voterNumber, labelAr: "رقمك في الكشوف" },
        { label: "Voting Date", value: context.votingDate, labelAr: "تاريخ التصويت" },
        { label: "Attendance", value: context.attendanceDensity, labelAr: "كثافة الحضور" },
        { label: "Individual Circle", value: context.individualCircle, labelAr: "دائرة الفردي" },
        { label: "List Circle", value: context.listCircle, labelAr: "دائرة القائمة" },
      ];

      let yPosition = height - 190;
      const rowHeight = 30;

      fields.forEach((field, index) => {
        const y = yPosition - (index * rowHeight);
        
        if (index % 2 === 0) {
          page.drawRectangle({
            x: 45,
            y: y - 10,
            width: width - 90,
            height: rowHeight,
            color: rgb(0.95, 0.95, 0.95),
          });
        }

        page.drawText(`${field.label}:`, {
          x: 55,
          y: y,
          size: 10,
          font: boldFont,
          color: rgb(0, 0, 0),
        });

        page.drawText(field.value || "-", {
          x: 200,
          y: y,
          size: 10,
          font: font,
          color: rgb(0.2, 0.2, 0.2),
        });

        page.drawText(field.labelAr, {
          x: width - 150,
          y: y,
          size: 10,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
        });
      });

      const timestamp = new Date().toISOString();
      page.drawText(`Generated: ${timestamp}`, {
        x: 50,
        y: 50,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText("https://www.elections.eg/inquiry", {
        x: 50,
        y: 35,
        size: 8,
        font: font,
        color: rgb(0.3, 0.3, 0.7),
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

      const outputDir = "generated_pdfs";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const fileName = `electoral_${context.nationalId}_${Date.now()}.pdf`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, pdfBytes);

      logger?.info(`✅ [generateElectoralPdf] PDF created successfully: ${filePath}`);

      return {
        success: true,
        pdfPath: filePath,
        pdfBase64,
        message: `تم إنشاء ملف الاستعلام بنجاح`,
      };
    } catch (error) {
      logger?.error("❌ [generateElectoralPdf] Error creating PDF:", error);
      return {
        success: false,
        pdfPath: "",
        pdfBase64: "",
        message: `حدث خطأ أثناء إنشاء ملف PDF: ${error}`,
      };
    }
  },
});
