import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import ArabicReshaper from "arabic-reshaper";
// @ts-ignore
import bidiFactory from "bidi-js";

const bidi = bidiFactory();

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

function processArabicText(text: string): string {
  if (!text) return '';
  
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  if (!hasArabic) return text;
  
  try {
    const reshaped = ArabicReshaper.reshape(text);
    const reordered = bidi.getReorderedString(reshaped, { 
      direction: 'rtl' 
    });
    return reordered;
  } catch (error) {
    console.warn('Error processing Arabic text, using fallback:', error);
    return text.split('').reverse().join('');
  }
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
    
    const fontPath = path.join(process.cwd(), 'fonts', 'Amiri-Regular.ttf');
    const boldFontPath = path.join(process.cwd(), 'fonts', 'Amiri-Bold.ttf');
    
    let fontBytes: Buffer;
    let boldFontBytes: Buffer;
    
    try {
      fontBytes = fs.readFileSync(fontPath);
      boldFontBytes = fs.readFileSync(boldFontPath);
    } catch (fontError) {
      console.error("Font files not found, trying alternative path...");
      const altFontPath = path.join('/home/runner/workspace', 'fonts', 'Amiri-Regular.ttf');
      const altBoldFontPath = path.join('/home/runner/workspace', 'fonts', 'Amiri-Bold.ttf');
      fontBytes = fs.readFileSync(altFontPath);
      boldFontBytes = fs.readFileSync(altBoldFontPath);
    }
    
    const arabicFont = await pdfDoc.embedFont(fontBytes);
    const arabicBoldFont = await pdfDoc.embedFont(boldFontBytes);
    
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const randomDate = getRandomDate();
    page.drawText(randomDate, {
      x: 30,
      y: height - 30,
      size: 10,
      font: arabicFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    page.drawText("1/1", {
      x: width - 40,
      y: 30,
      size: 10,
      font: arabicFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    const headerText = processArabicText("خدمة الاستعلام عن اللجان الانتخابية");
    const headerWidth = arabicFont.widthOfTextAtSize(headerText, 14);
    page.drawText(headerText, {
      x: (width - headerWidth) / 2,
      y: height - 60,
      size: 14,
      font: arabicFont,
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

    const nationalIdPart1 = processArabicText("الرقم القومي");
    const nationalIdPart2 = `(${data.nationalId})`;
    const nationalIdPart3 = processArabicText("له حق الانتخاب");
    
    const fullNationalIdText = `${nationalIdPart3} ${nationalIdPart2} ${nationalIdPart1}`;
    const nationalIdWidth = arabicFont.widthOfTextAtSize(fullNationalIdText, 12);
    page.drawText(fullNationalIdText, {
      x: (width - nationalIdWidth) / 2,
      y: greenBoxY - 15,
      size: 12,
      font: arabicFont,
      color: rgb(0.2, 0.5, 0.2),
    });

    const tableStartY = greenBoxY - 80;
    const tableWidth = width - 80;
    const tableX = 40;
    const headerHeight = 35;
    const rowHeight = 35;
    const numRows = 10;
    const tableHeight = rowHeight * numRows + headerHeight;

    page.drawRectangle({
      x: tableX,
      y: tableStartY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: rgb(0.2, 0.4, 0.7),
    });

    const tableHeaderText = processArabicText("بيانات اللجنة الانتخابية");
    const tableHeaderWidth = arabicBoldFont.widthOfTextAtSize(tableHeaderText, 14);
    page.drawText(tableHeaderText, {
      x: tableX + (tableWidth - tableHeaderWidth) / 2,
      y: tableStartY - 25,
      size: 14,
      font: arabicBoldFont,
      color: rgb(1, 1, 1),
    });

    const tableData = [
      { label: processArabicText("مركزك الانتخابي:"), value: processArabicText(data.pollingStation) },
      { label: processArabicText("المحافظة:"), value: processArabicText(data.governorate) },
      { label: processArabicText("المركز:"), value: processArabicText(data.center) },
      { label: processArabicText("العنوان:"), value: processArabicText(data.address) },
      { label: processArabicText("رقم اللجنة الفرعية:"), value: processArabicText(data.subcommitteeNumber) },
      { label: processArabicText("رقمك في الكشوف الانتخابية:"), value: processArabicText(data.voterNumber) },
      { label: processArabicText("تاريخ التصويت:"), value: processArabicText(data.votingDate) },
      { label: processArabicText("كثافة الحضور:"), value: processArabicText(data.attendanceDensity) },
      { label: processArabicText("دائرة الفردي:"), value: processArabicText(data.individualCircle) },
      { label: processArabicText("دائرة القائمة:"), value: processArabicText(data.listCircle) },
    ];

    const labelColWidth = 180;

    for (let i = 0; i < numRows; i++) {
      const rowY = tableStartY - headerHeight - (i + 1) * rowHeight;
      
      if (i % 2 === 1) {
        page.drawRectangle({
          x: tableX,
          y: rowY,
          width: tableWidth,
          height: rowHeight,
          color: rgb(0.97, 0.97, 0.97),
        });
      }

      page.drawLine({
        start: { x: tableX, y: rowY },
        end: { x: tableX + tableWidth, y: rowY },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      const labelText = tableData[i].label;
      const labelWidth = arabicBoldFont.widthOfTextAtSize(labelText, 11);
      page.drawText(labelText, {
        x: tableX + tableWidth - labelWidth - 10,
        y: rowY + 12,
        size: 11,
        font: arabicBoldFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      const valueText = tableData[i].value;
      const valueWidth = arabicFont.widthOfTextAtSize(valueText, 10);
      page.drawText(valueText, {
        x: tableX + tableWidth - labelColWidth - valueWidth - 20,
        y: rowY + 12,
        size: 10,
        font: arabicFont,
        color: rgb(0.2, 0.2, 0.2),
      });
    }

    page.drawLine({
      start: { x: tableX, y: tableStartY - headerHeight - numRows * rowHeight },
      end: { x: tableX + tableWidth, y: tableStartY - headerHeight - numRows * rowHeight },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawRectangle({
      x: tableX,
      y: tableStartY - tableHeight,
      width: tableWidth,
      height: tableHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    page.drawLine({
      start: { x: tableX + tableWidth - labelColWidth, y: tableStartY - headerHeight },
      end: { x: tableX + tableWidth - labelColWidth, y: tableStartY - tableHeight },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText("https://www.elections.eg/inquiry", {
      x: 30,
      y: 50,
      size: 8,
      font: arabicFont,
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

    console.log(`✅ [generateElectoralPdf] PDF created successfully: ${filePath}`);

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
