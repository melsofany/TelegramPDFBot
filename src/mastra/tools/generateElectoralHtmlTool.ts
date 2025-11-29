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
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Cairo', 'Segoe UI', sans-serif;
            background: #f5f5f5;
            padding: 20px;
            direction: rtl;
            text-align: right;
        }
        
        .container {
            max-width: 850px;
            margin: 0 0 0 auto;
            background: white;
            padding: 40px;
            padding-right: 20px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header-date {
            text-align: left;
            font-size: 12px;
            color: #666;
            margin-bottom: 30px;
        }
        
        .main-header {
            text-align: center;
            font-size: 16px;
            color: #333;
            margin-bottom: 30px;
            font-weight: 500;
        }
        
        .green-box {
            background: #eef9ee;
            border: 1px solid #c0e0c0;
            padding: 15px;
            margin-bottom: 30px;
            border-radius: 3px;
            text-align: center;
        }
        
        .green-box-text {
            font-size: 14px;
            color: #2d7a2d;
            font-weight: 500;
        }
        
        .table-title {
            font-size: 13px;
            color: #333;
            margin-bottom: 15px;
            font-weight: 600;
            text-align: right;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 8px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        th {
            display: none;
        }
        
        tr {
            border-bottom: 1px solid #e0e0e0;
        }
        
        td {
            padding: 12px;
            font-size: 12px;
        }
        
        td:first-child {
            text-align: right;
            font-weight: 600;
            color: #333;
            width: 35%;
        }
        
        td:last-child {
            text-align: right;
            color: #555;
        }
        
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #666;
            margin-top: 40px;
            border-top: 1px solid #e0e0e0;
            padding-top: 15px;
        }
        
        .footer-left {
            text-align: left;
        }
        
        .footer-right {
            text-align: right;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-date">${randomDate}</div>
        
        <div class="main-header">خدمة الاستعلام عن اللجان الانتخابية</div>
        
        <div class="green-box">
            <div class="green-box-text">الرقم القومي (${convertToArabicNumbers(data.nationalId)}) له حق الانتخاب</div>
        </div>
        
        <div class="table-title">بيانات اللجنة الانتخابية</div>
        
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
                    <td>${convertToArabicNumbers(data.subcommitteeNumber)}</td>
                </tr>
                <tr>
                    <td>رقمك في الكشوف الانتخابية:</td>
                    <td>${convertToArabicNumbers(data.voterNumber)}</td>
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
            <div class="footer-left">
                <a href="https://www.elections.eg/inquiry" style="color: #666; text-decoration: none;">https://www.elections.eg/inquiry</a>
            </div>
            <div class="footer-right">1/1</div>
        </div>
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
