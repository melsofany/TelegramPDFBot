import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import ArabicReshaper from "arabic-reshaper";

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
    return ArabicReshaper.convertArabic(text);
  } catch (error) {
    console.warn('Error processing Arabic text:', error);
    return text;
  }
}

export async function generateElectoralInquiryPdf(data: ElectoralInquiryData): Promise<{
  success: boolean;
  pdfPath: string;
  pdfBuffer: Buffer | null;
  message: string;
}> {
  try {
    const outputDir = "generated_pdfs";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `استعلام_${data.nationalId}.pdf`;
    const filePath = path.join(outputDir, fileName);

    // Load Cairo fonts
    let cairoRegularPath = path.join(process.cwd(), 'fonts', 'Cairo-Regular.ttf');
    let cairoBoldPath = path.join(process.cwd(), 'fonts', 'Cairo-Bold.ttf');

    if (!fs.existsSync(cairoRegularPath)) {
      cairoRegularPath = path.join('/home/runner/workspace', 'fonts', 'Cairo-Regular.ttf');
    }
    if (!fs.existsSync(cairoBoldPath)) {
      cairoBoldPath = path.join('/home/runner/workspace', 'fonts', 'Cairo-Bold.ttf');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 30;
    const contentWidth = pageWidth - 2 * margin;

    // Register fonts
    doc.registerFont('arabic', cairoRegularPath);
    doc.registerFont('arabic-bold', cairoBoldPath);

    // Random date
    const randomDate = getRandomDate();
    doc.fontSize(9)
      .font('arabic')
      .fillColor('#666666')
      .text(randomDate, margin, margin, { align: 'left', width: contentWidth });

    // Header
    const headerText = processArabicText("خدمة الاستعلام عن اللجان الانتخابية");
    doc.fontSize(11)
      .font('arabic')
      .fillColor('#4d4d4d')
      .text(headerText, margin, margin + 20, { align: 'center', width: contentWidth });

    // Green box
    const greenBoxY = margin + 60;
    const greenBoxHeight = 30;
    doc.rect(margin, greenBoxY, contentWidth, greenBoxHeight)
      .fillAndStroke('#edfcef', '#bfe0c4');

    const nationalIdText = processArabicText(`الرقم القومي (${data.nationalId}) له حق الانتخاب`);
    doc.fontSize(11)
      .font('arabic')
      .fillColor('#2d802d')
      .text(nationalIdText, margin + 10, greenBoxY + 8, { align: 'right', width: contentWidth - 20 });

    // Table header
    const tableStartY = greenBoxY + greenBoxHeight + 20;
    const tableWidth = contentWidth;
    const headerHeight = 28;
    const rowHeight = 32;
    const numRows = 10;
    const labelColWidth = 150;

    doc.rect(margin, tableStartY, tableWidth, headerHeight)
      .fillAndStroke('#4073b4', '#4073b4');

    const tableHeaderText = processArabicText("بيانات اللجنة الانتخابية");
    doc.fontSize(12)
      .font('arabic-bold')
      .fillColor('#ffffff')
      .text(tableHeaderText, margin + 10, tableStartY + 6, { align: 'right', width: tableWidth - 20 });

    // Table data
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

    // Draw table rows
    for (let i = 0; i < numRows; i++) {
      const rowY = tableStartY + headerHeight + i * rowHeight;

      // Alternating row color
      if (i % 2 === 1) {
        doc.rect(margin, rowY, tableWidth, rowHeight)
          .fillAndStroke('#f5f5f5', '#f5f5f5');
      } else {
        doc.rect(margin, rowY, tableWidth, rowHeight)
          .stroke('#d9d9d9');
      }

      // Draw label column border
      doc.moveTo(margin + tableWidth - labelColWidth, rowY)
        .lineTo(margin + tableWidth - labelColWidth, rowY + rowHeight)
        .stroke();

      // Label
      doc.fontSize(10)
        .font('arabic-bold')
        .fillColor('#595959')
        .text(tableData[i].label, margin + tableWidth - labelColWidth + 5, rowY + 10, { align: 'right', width: labelColWidth - 10 });

      // Value
      doc.fontSize(10)
        .font('arabic')
        .fillColor('#404040')
        .text(tableData[i].value, margin + 5, rowY + 10, { align: 'right', width: tableWidth - labelColWidth - 10 });
    }

    // Table bottom border
    const tableBottomY = tableStartY + headerHeight + numRows * rowHeight;
    doc.rect(margin, tableStartY, tableWidth, tableBottomY - tableStartY)
      .stroke('#c0c0c0');

    // Footer
    doc.fontSize(8)
      .font('arabic')
      .fillColor('#666666')
      .text("https://www.elections.eg/inquiry", margin, pageHeight - 50, { align: 'left' });

    doc.fontSize(8)
      .font('arabic')
      .fillColor('#666666')
      .text("1/1", pageWidth - margin - 40, pageHeight - 50, { align: 'right' });

    doc.end();

    return new Promise((resolve) => {
      stream.on('finish', () => {
        const pdfBuffer = fs.readFileSync(filePath);
        console.log(`✅ [generateElectoralPdf] PDF created successfully: ${filePath}`);
        resolve({
          success: true,
          pdfPath: filePath,
          pdfBuffer: pdfBuffer,
          message: `تم إنشاء ملف الاستعلام بنجاح`,
        });
      });

      stream.on('error', (err) => {
        console.error("❌ [generateElectoralPdf] Stream error:", err);
        resolve({
          success: false,
          pdfPath: "",
          pdfBuffer: null,
          message: `حدث خطأ أثناء إنشاء ملف PDF: ${err}`,
        });
      });
    });

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
