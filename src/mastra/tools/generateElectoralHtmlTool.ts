import { createTool } from "@mastra/core/tools";
import { z } from "zod";
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

function convertToArabicNumbers(text: string): string {
  const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = text;
  englishNumbers.forEach((eng, idx) => {
    result = result.replace(new RegExp(eng, 'g'), arabicNumbers[idx]);
  });
  return result;
}

function getRandomDate(): string {
  const days = [18, 19, 20, 21, 22];
  const randomDay = days[Math.floor(Math.random() * days.length)];
  const hours = Math.floor(Math.random() * 12) + 1;
  const minutes = Math.floor(Math.random() * 60);
  const ampm = Math.random() > 0.5 ? 'PM' : 'AM';
  const dateStr = `11/${randomDay}/25, ${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  return convertToArabicNumbers(dateStr);
}

export async function generateElectoralInquiryHtml(data: ElectoralInquiryData): Promise<{
  success: boolean;
  htmlPath: string;
  htmlContent: string;
  message: string;
}> {
  try {
    const randomDate = getRandomDate();
    
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>استعلام اللجان الانتخابية</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            width: 210mm;
            height: 297mm;
            font-family: 'Cairo', sans-serif;
            background: white;
            direction: rtl;
            text-align: right;
        }
        
        .page {
            width: 210mm;
            height: 297mm;
            padding: 15mm 15mm 15mm 15mm;
            background: white;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }
        
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            padding-bottom: 0;
        }
        
        .header-title {
            text-align: center;
            flex: 1;
            font-size: 10px;
            color: #333;
            font-weight: 500;
        }
        
        .header-date {
            text-align: left;
            font-size: 9px;
            color: #666;
            white-space: nowrap;
        }
        
        .green-box {
            background: #eef9ee;
            border: 1px solid #bfe0bf;
            padding: 12px;
            margin: 20px 0;
            text-align: center;
        }
        
        .green-box-text {
            font-size: 13px;
            color: #2d7a2d;
            font-weight: 500;
        }
        
        .section-title {
            font-size: 13px;
            color: #333;
            margin-top: 20px;
            margin-bottom: 10px;
            font-weight: 600;
            text-align: right;
            align-self: flex-end;
            width: 100%;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            margin-right: 0;
            border: 1px solid #d5d5d5;
        }
        
        th {
            display: none;
        }
        
        tr {
            border-bottom: 1px solid #d5d5d5;
        }
        
        tr:last-child {
            border-bottom: 1px solid #d5d5d5;
        }
        
        td {
            padding: 9px 10px;
            font-size: 12px;
            color: #333;
            border-right: 1px solid #d5d5d5;
        }
        
        td:last-child {
            border-right: 1px solid #d5d5d5;
        }
        
        td:first-child {
            text-align: right;
            font-weight: 600;
            width: 40%;
            padding-right: 10px;
        }
        
        td:last-child {
            text-align: right;
            width: 60%;
            padding-left: 10px;
        }
        
        .footer {
            position: absolute;
            bottom: 12mm;
            left: 15mm;
            right: 15mm;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #666;
            padding-top: 0;
        }
        
        .footer-right {
            text-align: right;
        }
        
        .footer-left {
            text-align: left;
        }
        
        .page-number {
            position: absolute;
            bottom: 12mm;
            right: 15mm;
            font-size: 10px;
            color: #999;
        }
        
        @media print {
            html, body {
                margin: 0;
                padding: 0;
                width: 210mm;
                height: 297mm;
            }
            
            .page {
                margin: 0;
                padding: 15mm;
                box-shadow: none;
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header-top">
            <div class="header-title">خدمة الاستعلام عن اللجان الانتخابية</div>
            <div class="header-date">${randomDate}</div>
        </div>
        
        <div class="green-box">
            <div class="green-box-text">الرقم القومي (${convertToArabicNumbers(data.nationalId)}) له حق الانتخاب</div>
        </div>
        
        <div class="section-title">بيانات اللجنة الانتخابية</div>
        
        <table>
            <tbody>
                <tr>
                    <td>مركزك الانتخابي:</td>
                    <td>${data.pollingStation}</td>
                </tr>
                <tr>
                    <td>المحافظة:</td>
                    <td>${data.governorate}</td>
                </tr>
                <tr>
                    <td>المركز:</td>
                    <td>${data.center}</td>
                </tr>
                <tr>
                    <td>العنوان:</td>
                    <td>${data.address}</td>
                </tr>
                <tr>
                    <td>رقم اللجنة الفرعية:</td>
                    <td>${data.subcommitteeNumber}</td>
                </tr>
                <tr>
                    <td>رقمك في الكشوف الانتخابية:</td>
                    <td>${data.voterNumber}</td>
                </tr>
                <tr>
                    <td>تاريخ التصويت:</td>
                    <td>${data.votingDate}</td>
                </tr>
                <tr>
                    <td>كثافة الحضور:</td>
                    <td>${data.attendanceDensity}</td>
                </tr>
                <tr>
                    <td>دائرة الفردي:</td>
                    <td>${data.individualCircle}</td>
                </tr>
                <tr>
                    <td>دائرة القائمة:</td>
                    <td>${data.listCircle}</td>
                </tr>
            </tbody>
        </table>
        
        <div class="footer">
            <div class="footer-right"></div>
            <div class="footer-left">
                <a href="https://www.elections.eg/inquiry" style="color: #666; text-decoration: none;">https://www.elections.eg/inquiry</a>
            </div>
        </div>
        <div class="page-number">١/١</div>
    </div>
</body>
</html>`;

    const outputDir = "generated_html";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const fileName = `استعلام_${data.nationalId}.html`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, htmlContent);

    console.log(`✅ [generateElectoralHtml] HTML created successfully: ${filePath}`);

    return {
      success: true,
      htmlPath: filePath,
      htmlContent: htmlContent,
      message: `تم إنشاء ملف الاستعلام بنجاح`,
    };
  } catch (error) {
    console.error("❌ [generateElectoralHtml] Error creating HTML:", error);
    return {
      success: false,
      htmlPath: "",
      htmlContent: "",
      message: `حدث خطأ أثناء إنشاء ملف HTML: ${error}`,
    };
  }
}

export const generateElectoralHtmlTool = createTool({
  id: "generate-electoral-html",
  description: `أداة لإنشاء ملف HTML يحتوي على بيانات اللجنة الانتخابية بالتنسيق الرسمي.
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
    htmlPath: z.string(),
    htmlContent: z.string(),
    message: z.string(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📄 [generateElectoralHtml] Creating HTML with data:", context);

    const result = await generateElectoralInquiryHtml(context);
    
    return {
      success: result.success,
      htmlPath: result.htmlPath,
      htmlContent: result.htmlContent,
      message: result.message,
    };
  },
});
