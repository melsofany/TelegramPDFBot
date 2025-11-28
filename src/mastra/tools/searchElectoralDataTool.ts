import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const PDF_FILES: Record<string, string> = {
  "مركز طما": "attached_assets/‎⁨مركز طما⁩_1764329849045.pdf",
  "مركز طهطا": "attached_assets/‎⁨مركز طهطا⁩_1764329849045.pdf",
  "قسم طهطا": "attached_assets/‎⁨قسم طهطا⁩_1764329849045.pdf",
};

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

async function extractDataFromPDF(pdfPath: string): Promise<string> {
  try {
    if (!fs.existsSync(pdfPath)) {
      return "";
    }
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error reading PDF ${pdfPath}:`, error);
    return "";
  }
}

function searchInText(text: string, searchName: string): ElectoralData[] {
  const results: ElectoralData[] = [];
  const lines = text.split("\n");
  
  const normalizedSearchName = searchName.trim().toLowerCase();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    if (line.includes(normalizedSearchName)) {
      const data: ElectoralData = {
        name: searchName,
        nationalId: "",
        pollingStation: "",
        governorate: "سوهاج",
        center: "",
        address: "",
        subcommitteeNumber: "",
        voterNumber: "",
        votingDate: "",
        attendanceDensity: "",
        individualCircle: "",
        listCircle: "",
        region: "",
      };
      
      for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 10); j++) {
        const contextLine = lines[j].trim();
        
        if (/\d{14}/.test(contextLine)) {
          const match = contextLine.match(/\d{14}/);
          if (match) data.nationalId = match[0];
        }
        
        if (contextLine.includes("مدرسة") || contextLine.includes("لجنة")) {
          if (!data.pollingStation) data.pollingStation = contextLine;
        }
        
        if (contextLine.includes("شارع") || contextLine.includes("طريق")) {
          if (!data.address) data.address = contextLine;
        }
      }
      
      results.push(data);
    }
  }
  
  return results;
}

export const searchElectoralDataTool = createTool({
  id: "search-electoral-data",
  description: `أداة للبحث عن بيانات اللجان الانتخابية بالاسم في منطقة محددة.
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
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [searchElectoralData] Starting search with params:", context);

    const { region, searchName } = context;
    
    const pdfPath = PDF_FILES[region];
    if (!pdfPath) {
      logger?.warn("❌ [searchElectoralData] Invalid region:", region);
      return {
        found: false,
        results: [],
        message: `المنطقة غير صالحة: ${region}. الرجاء اختيار من: مركز طما، مركز طهطا، قسم طهطا`,
        region,
      };
    }

    logger?.info(`📂 [searchElectoralData] Searching in PDF: ${pdfPath}`);

    const pdfText = await extractDataFromPDF(pdfPath);
    
    if (!pdfText) {
      logger?.warn("⚠️ [searchElectoralData] PDF file not found or empty");
      return {
        found: false,
        results: [],
        message: `ملف بيانات ${region} غير موجود. الرجاء رفع الملف أولاً.`,
        region,
      };
    }

    const results = searchInText(pdfText, searchName);
    
    results.forEach(r => {
      r.region = region;
      r.center = region;
    });

    logger?.info(`✅ [searchElectoralData] Found ${results.length} results`);

    if (results.length === 0) {
      return {
        found: false,
        results: [],
        message: `لم يتم العثور على "${searchName}" في ${region}. تأكد من كتابة الاسم بشكل صحيح.`,
        region,
      };
    }

    return {
      found: true,
      results,
      message: `تم العثور على ${results.length} نتيجة لـ "${searchName}" في ${region}`,
      region,
    };
  },
});
