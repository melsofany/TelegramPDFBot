import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";
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
  try {
    return ArabicReshaper.convertArabic(text);
  } catch (error) {
    return text;
  }
}

async function generateHtmlPdf(data: ElectoralInquiryData): Promise<Buffer> {
  const randomDate = getRandomDate();
  
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          font-family: 'Cairo', sans-serif;
        }
        
        body {
          background: white;
          padding: 30px;
          line-height: 1.4;
        }
        
        .container {
          max-width: 595px;
          margin: 0 auto;
          background: white;
        }
        
        .header-date {
          font-size: 9px;
          color: #666666;
          margin-bottom: 20px;
          text-align: left;
        }
        
        .header-title {
          font-size: 11px;
          color: #4d4d4d;
          text-align: center;
          margin-bottom: 20px;
          font-weight: 500;
        }
        
        .green-box {
          background-color: #edfcef;
          border: 1px solid #bfe0c4;
          padding: 10px;
          margin-bottom: 20px;
          text-align: center;
          font-size: 11px;
          color: #2d802d;
          font-weight: 500;
        }
        
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          border: 1px solid #c0c0c0;
        }
        
        .table-header {
          background-color: #4073b4;
          color: white;
          font-weight: 700;
          font-size: 12px;
          padding: 10px;
          text-align: right;
        }
        
        .table-row {
          border-bottom: 1px solid #d9d9d9;
          font-size: 10px;
        }
        
        .table-row.even {
          background-color: #f5f5f5;
        }
        
        .table-row.odd {
          background-color: white;
        }
        
        .table-cell {
          padding: 10px;
          border-right: 1px solid #d9d9d9;
        }
        
        .label-cell {
          text-align: right;
          font-weight: 700;
          color: #595959;
          width: 150px;
          background-color: #f9f9f9;
        }
        
        .value-cell {
          text-align: right;
          color: #404040;
          flex: 1;
        }
        
        .footer {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #666666;
          margin-top: 30px;
        }
        
        .footer-left {
          text-align: left;
        }
        
        .footer-right {
          text-align: right;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header-date">${randomDate}</div>
        
        <div class="header-title">${processArabicText("خدمة الاستعلام عن اللجان الانتخابية")}</div>
        
        <div class="green-box">
          ${processArabicText(`الرقم القومي (${data.nationalId}) له حق الانتخاب`)}
        </div>
        
        <table class="table">
          <thead>
            <tr>
              <th colspan="2" class="table-header">${processArabicText("بيانات اللجنة الانتخابية")}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="table-row even">
              <td class="table-cell value-cell">${processArabicText(data.pollingStation)}</td>
              <td class="table-cell label-cell">${processArabicText("مركزك الانتخابي:")}</td>
            </tr>
            <tr class="table-row odd">
              <td class="table-cell value-cell">${processArabicText(data.governorate)}</td>
              <td class="table-cell label-cell">${processArabicText("المحافظة:")}</td>
            </tr>
            <tr class="table-row even">
              <td class="table-cell value-cell">${processArabicText(data.center)}</td>
              <td class="table-cell label-cell">${processArabicText("المركز:")}</td>
            </tr>
            <tr class="table-row odd">
              <td class="table-cell value-cell">${processArabicText(data.address)}</td>
              <td class="table-cell label-cell">${processArabicText("العنوان:")}</td>
            </tr>
            <tr class="table-row even">
              <td class="table-cell value-cell">${processArabicText(data.subcommitteeNumber)}</td>
              <td class="table-cell label-cell">${processArabicText("رقم اللجنة الفرعية:")}</td>
            </tr>
            <tr class="table-row odd">
              <td class="table-cell value-cell">${processArabicText(data.voterNumber)}</td>
              <td class="table-cell label-cell">${processArabicText("رقمك في الكشوف الانتخابية:")}</td>
            </tr>
            <tr class="table-row even">
              <td class="table-cell value-cell">${processArabicText(data.votingDate)}</td>
              <td class="table-cell label-cell">${processArabicText("تاريخ التصويت:")}</td>
            </tr>
            <tr class="table-row odd">
              <td class="table-cell value-cell">${processArabicText(data.attendanceDensity)}</td>
              <td class="table-cell label-cell">${processArabicText("كثافة الحضور:")}</td>
            </tr>
            <tr class="table-row even">
              <td class="table-cell value-cell">${processArabicText(data.individualCircle)}</td>
              <td class="table-cell label-cell">${processArabicText("دائرة الفردي:")}</td>
            </tr>
            <tr class="table-row odd">
              <td class="table-cell value-cell">${processArabicText(data.listCircle)}</td>
              <td class="table-cell label-cell">${processArabicText("دائرة القائمة:")}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <div class="footer-left">https://www.elections.eg/inquiry</div>
          <div class="footer-right">1/1</div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' } });
    await browser.close();
    
    return pdfBuffer;
  } catch (error) {
    console.error("Error generating PDF with puppeteer:", error);
    throw error;
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

    const pdfBuffer = await generateHtmlPdf(data);
    fs.writeFileSync(filePath, pdfBuffer);

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
    logger?.info("📄 [generateElectoralPdf] Creating PDF with Cairo font using puppeteer:", context);

    const result = await generateElectoralInquiryPdf(context);
    
    return {
      success: result.success,
      pdfPath: result.pdfPath,
      pdfBase64: result.pdfBuffer ? result.pdfBuffer.toString("base64") : "",
      message: result.message,
    };
  },
});
