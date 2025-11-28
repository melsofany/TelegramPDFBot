import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function findPdfFile(region: string): string | null {
  const assetsDir = "/home/runner/workspace/attached_assets";
  
  try {
    const files = fs.readdirSync(assetsDir);
    const normalizedRegion = region.replace(/[\u200e\u200f\u2068\u2069]/g, '').trim();
    
    console.log(`Looking for region: "${normalizedRegion}" in ${files.length} files`);
    
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        const normalizedFile = file.replace(/[\u200e\u200f\u2068\u2069]/g, '');
        console.log(`Checking file: "${normalizedFile}"`);
        if (normalizedFile.includes(normalizedRegion)) {
          const fullPath = path.join(assetsDir, file);
          console.log(`Found matching file: ${fullPath}`);
          return fullPath;
        }
      }
    }
  } catch (error) {
    console.error("Error reading assets directory:", error);
  }
  
  return null;
}

export interface ElectoralData {
  name: string;
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
  region: string;
}

const uploadedFiles: Record<string, string> = {};

async function uploadPdfToGoogleAI(pdfPath: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  
  if (uploadedFiles[pdfPath]) {
    console.log("Using cached file URI:", uploadedFiles[pdfPath]);
    return uploadedFiles[pdfPath];
  }
  
  try {
    const fileManager = new GoogleAIFileManager(apiKey);
    
    console.log("Uploading PDF to Google AI Files API...");
    const uploadResult = await fileManager.uploadFile(pdfPath, {
      mimeType: "application/pdf",
      displayName: path.basename(pdfPath),
    });
    
    console.log(`Uploaded file: ${uploadResult.file.name}, URI: ${uploadResult.file.uri}`);
    
    let file = uploadResult.file;
    while (file.state === "PROCESSING") {
      console.log("Waiting for file to be processed...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      file = await fileManager.getFile(file.name);
    }
    
    if (file.state === "FAILED") {
      console.error("File processing failed");
      return null;
    }
    
    uploadedFiles[pdfPath] = file.uri;
    return file.uri;
  } catch (error) {
    console.error("Error uploading PDF:", error);
    return null;
  }
}

async function searchInPDFWithGemini(pdfPath: string, searchName: string): Promise<{
  found: boolean;
  results: ElectoralData[];
  rawResponse: string;
}> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_GENERATIVE_AI_API_KEY not set");
    return { found: false, results: [], rawResponse: "API key not configured" };
  }

  try {
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF file not found: ${pdfPath}`);
      return { found: false, results: [], rawResponse: "File not found" };
    }

    console.log("Uploading PDF to Google AI...");
    const fileUri = await uploadPdfToGoogleAI(pdfPath);
    
    if (!fileUri) {
      console.error("Failed to upload PDF to Google AI");
      return { found: false, results: [], rawResponse: "Failed to upload PDF" };
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `أنت خبير في البحث في كشوف الناخبين المصرية. ابحث عن كل شخص اسمه يطابق أو يشبه: "${searchName}"

البحث:
1. ابحث عن تطابق دقيق للاسم الكامل
2. ابحث عن تطابق جزئي (أي كلمة من الاسم)
3. ابحث عن نطق قريب أو أخطاء إملائية

عند إيجاد نتائج، اعرض كل نتيجة بالتنسيق:
---
الاسم: [الاسم الكامل كما هو مكتوب في الكشف]
الرقم القومي: [14 رقم إن وجد]
مقر الانتخاب: [اسم المدرسة]
رقم اللجنة: [رقم اللجنة الفرعية]
---

إذا لم تجد أي نتيجة بعد البحث الشامل، اكتب: "لم يتم العثور على أي نتائج"`;

    console.log("Sending request to Gemini with file URI...");
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: "application/pdf",
          fileUri: fileUri,
        },
      },
      { text: prompt },
    ]);

    const responseText = result.response.text();
    console.log("Gemini response length:", responseText.length);

    if (responseText.includes("لم يتم العثور") || responseText.includes("لم أجد") || responseText.includes("غير موجود")) {
      return { found: false, results: [], rawResponse: responseText };
    }

    const results: ElectoralData[] = [];
    const sections = responseText.split("---").filter(s => s.trim() && s.includes("الاسم:"));

    for (const section of sections) {
      const data: ElectoralData = {
        name: extractField(section, "الاسم") || searchName,
        nationalId: extractField(section, "الرقم القومي") || "",
        pollingStation: extractField(section, "مقر الانتخاب") || "",
        governorate: "سوهاج",
        center: "",
        address: "",
        subcommitteeNumber: extractField(section, "رقم اللجنة") || "",
        voterNumber: "",
        votingDate: "",
        attendanceDensity: "",
        individualCircle: "",
        listCircle: "",
        region: "",
      };
      results.push(data);
    }

    return { 
      found: results.length > 0, 
      results, 
      rawResponse: responseText 
    };

  } catch (error) {
    console.error(`Error searching PDF with Gemini:`, error);
    return { found: false, results: [], rawResponse: `Error: ${String(error)}` };
  }
}

function extractField(text: string, fieldName: string): string {
  const patterns = [
    new RegExp(`${fieldName}[:\\s]+([^\\n]+)`, 'i'),
    new RegExp(`${fieldName}[:\\s]*([^\\n]+)`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/^\[|\]$/g, '');
    }
  }
  return "";
}

function extractFromText(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match ? match[0] : "";
}

export const searchElectoralDataTool = createTool({
  id: "search-electoral-data",
  description: `أداة للبحث عن بيانات اللجان الانتخابية بالاسم في منطقة محددة باستخدام Google AI.
  استخدم هذه الأداة عندما يريد المستخدم البحث عن بيانات انتخابية.
  يجب تحديد المنطقة (مركز طما / مركز طهطا / قسم طهطا) والاسم للبحث.`,

  inputSchema: z.object({
    region: z.enum(["مركز طما", "مركز طهطا", "قسم طهطا"]).describe("المنطقة للبحث فيها"),
    searchName: z.string().describe("اسم الشخص للبحث عنه"),
  }),

  outputSchema: z.object({
    found: z.boolean(),
    results: z.array(z.object({
      name: z.string(),
      nationalId: z.string(),
      pollingStation: z.string(),
      governorate: z.string(),
      center: z.string(),
      address: z.string(),
      subcommitteeNumber: z.string(),
      voterNumber: z.string(),
      votingDate: z.string(),
      attendanceDensity: z.string(),
      individualCircle: z.string(),
      listCircle: z.string(),
      region: z.string(),
    })),
    message: z.string(),
    region: z.string(),
    rawResponse: z.string().optional(),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [searchElectoralData] Starting search with Google AI:", context);

    const { region, searchName } = context;
    
    const pdfPath = findPdfFile(region);
    if (!pdfPath) {
      logger?.warn("❌ [searchElectoralData] PDF file not found for region:", region);
      return {
        found: false,
        results: [],
        message: `لم يتم العثور على ملف المنطقة: ${region}. الرجاء اختيار من: مركز طما، مركز طهطا، قسم طهطا`,
        region,
      };
    }
    
    logger?.info("📁 [searchElectoralData] Found PDF file:", pdfPath);

    logger?.info(`📂 [searchElectoralData] Searching in PDF with Gemini: ${pdfPath}`);
    logger?.info(`🔎 [searchElectoralData] Search name: ${searchName}`);

    const { found, results, rawResponse } = await searchInPDFWithGemini(pdfPath, searchName);
    
    results.forEach(r => {
      r.region = region;
      r.center = region;
    });

    logger?.info(`✅ [searchElectoralData] Found ${results.length} results`);
    logger?.info(`📝 [searchElectoralData] Raw response preview: ${rawResponse.substring(0, 200)}`);

    if (!found || results.length === 0) {
      return {
        found: false,
        results: [],
        message: `لم يتم العثور على "${searchName}" في ${region}. تأكد من كتابة الاسم بشكل صحيح.`,
        region,
        rawResponse,
      };
    }

    return {
      found: true,
      results,
      message: `تم العثور على ${results.length} نتيجة لـ "${searchName}" في ${region}`,
      region,
      rawResponse,
    };
  },
});
