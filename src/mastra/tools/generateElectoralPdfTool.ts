import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs";
import * as path from "path";

interface ElectoralInquiryData {
  nationalId: string;
  pollingStation: string;
  governorate: string;
  center: string;
  address: string;
  subcommitteeNumber: string;
  voterNumber: string;
  votingDate: string;
  attendanceDensity: string;
  individualCircle: string;
  listCircle: string;
}

function getRandomDate(): string {
  const days = [18, 19, 20, 21, 22];
  const randomDay = days[Math.floor(Math.random() * days.length)];
  const hours = Math.floor(Math.random() * 12) + 1;
  const minutes = Math.floor(Math.random() * 60);
  const ampm = Math.random() > 0.5 ? 'PM' : 'AM';
  return `11/${randomDay}/25, ${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export async function generateElectoralInquiryPdf(data: ElectoralInquiryData): Promise<{
  success: boolean;
  pdfPath: string;
  pdfBuffer: Buffer | null;
  message: string;
}> {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const randomDate = getRandomDate();
    page.drawText(randomDate, {
      x: 30,
      y: height - 30,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });

    page.drawText("1/1", {
      x: width - 40,
      y: 30,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });

    const headerY = height - 60;
    page.drawText("ةيباختنلاا ناجللا نع ملاعتسلاا ةمدخ", {
      x: width / 2 - 100,
      y: headerY,
      size: 12,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });

    const greenBoxY = height - 120;
    page.drawRectangle({
      x: 40,
      y: greenBoxY - 30,
      width: width - 80,
      height: 40,
      color: rgb(0.9, 0.97, 0.9),
      borderColor: rgb(0.6, 0.8, 0.6),
      borderWidth: 1,
    });

    const nationalIdDisplay = `(${data.nationalId})`;
    page.drawText(`باختنلاا قح هل ${nationalIdDisplay} يموقلا مقرلا`, {
      x: width / 2 - 80,
      y: greenBoxY - 18,
      size: 11,
      font: font,
      color: rgb(0.2, 0.5, 0.2),
    });

    const tableStartY = greenBoxY - 80;
    const tableWidth = width - 80;
    const tableX = 40;
    const rowHeight = 35;
    const numRows = 10;
    const tableHeight = rowHeight * numRows + 40;

    page.drawRectangle({
      x: tableX,
      y: tableStartY - tableHeight + 40,
      width: tableWidth,
      height: 35,
      color: rgb(0.2, 0.4, 0.7),
    });

    page.drawText("ةيباختنلاا ةنجللا تانايب", {
      x: tableX + tableWidth / 2 - 60,
      y: tableStartY + 8,
      size: 14,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    const tableData = [
      { label: ":يباختنلاا كزكرم", value: data.pollingStation },
      { label: ":ةظفاحملا", value: data.governorate },
      { label: ":زكرملا", value: data.center },
      { label: ":ناونعلا", value: data.address },
      { label: ":ةيعرفلا ةنجللا مقر", value: data.subcommitteeNumber },
      { label: ":ةيباختنلاا فوشكلا يف كمقر", value: data.voterNumber },
      { label: ":تيوصتلا خيرات", value: data.votingDate },
      { label: ":روضحلا ةفاثك", value: data.attendanceDensity },
      { label: ":يدرفلا ةرئاد", value: data.individualCircle },
      { label: ":ةمئاقلا ةرئاد", value: data.listCircle },
    ];

    const labelColWidth = 150;
    const valueColWidth = tableWidth - labelColWidth;

    for (let i = 0; i < numRows; i++) {
      const rowY = tableStartY - (i + 1) * rowHeight;
      
      if (i % 2 === 1) {
        page.drawRectangle({
          x: tableX,
          y: rowY - rowHeight + 10,
          width: tableWidth,
          height: rowHeight,
          color: rgb(0.97, 0.97, 0.97),
        });
      }

      page.drawLine({
        start: { x: tableX, y: rowY - rowHeight + 10 },
        end: { x: tableX + tableWidth, y: rowY - rowHeight + 10 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      page.drawText(tableData[i].label, {
        x: tableX + tableWidth - labelColWidth + 10,
        y: rowY - 18,
        size: 10,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText(tableData[i].value, {
        x: tableX + valueColWidth - 10 - (tableData[i].value.length * 4),
        y: rowY - 18,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }

    page.drawRectangle({
      x: tableX,
      y: tableStartY - tableHeight + 10,
      width: tableWidth,
      height: tableHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    page.drawLine({
      start: { x: tableX + tableWidth - labelColWidth, y: tableStartY },
      end: { x: tableX + tableWidth - labelColWidth, y: tableStartY - tableHeight + 10 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText("https://www.elections.eg/inquiry", {
      x: 30,
      y: 50,
      size: 8,
      font: font,
      color: rgb(0.3, 0.3, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const outputDir = "generated_pdfs";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const fileName = `electoral_${data.nationalId}_${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);

    return {
      success: true,
      pdfPath: filePath,
      pdfBuffer: pdfBuffer,
      message: `تم إنشاء ملف الاستعلام بنجاح`,
    };
  } catch (error) {
    console.error("❌ [generateElectoralPdf] Error creating PDF:", error);
    return {
      success: false,
      pdfPath: "",
      pdfBuffer: null,
      message: `حدث خطأ أثناء إنشاء ملف PDF: ${error}`,
    };
  }
}

export const generateElectoralPdfTool = createTool({
  id: "generate-electoral-pdf",
  description: `أداة لإنشاء ملف PDF يحتوي على بيانات اللجنة الانتخابية بالتنسيق الرسمي.
  استخدم هذه الأداة بعد جمع كل بيانات الناخب.`,

  inputSchema: z.object({
    nationalId: z.string().describe("الرقم القومي للناخب"),
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

    const result = await generateElectoralInquiryPdf(context);
    
    return {
      success: result.success,
      pdfPath: result.pdfPath,
      pdfBase64: result.pdfBuffer ? result.pdfBuffer.toString("base64") : "",
      message: result.message,
    };
  },
});
