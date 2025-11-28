import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const PDF_FILES: Record<string, string> = {
  "مركز طما": "attached_assets/‎⁨مركز طما⁩_1764329849045.pdf",
  "مركز طهطا": "attached_assets/‎⁨مركز طهطا⁩_1764329849045.pdf",
  "قسم طهطا": "attached_assets/‎⁨قسم طهطا⁩_1764329849045.pdf",
};

const SPLIT_OUTPUT_DIR = "attached_assets/split_pdfs";
const METADATA_FILE = "attached_assets/split_pdfs/metadata.json";
const PAGES_PER_CHUNK = 10;

interface ChunkInfo {
  chunkNumber: number;
  startPage: number;
  endPage: number;
  fileName: string;
}

interface CenterMetadata {
  center: string;
  originalFile: string;
  totalPages: number;
  chunks: ChunkInfo[];
  splitDate: string;
}

interface AllMetadata {
  centers: Record<string, CenterMetadata>;
  lastUpdated: string;
}

async function splitPdfIntoChunks(
  region: string,
  pdfPath: string,
  logger?: any
): Promise<CenterMetadata | null> {
  logger?.info(`📂 [splitPdf] Starting split for ${region}: ${pdfPath}`);

  try {
    if (!fs.existsSync(pdfPath)) {
      logger?.error(`❌ [splitPdf] PDF file not found: ${pdfPath}`);
      return null;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();

    logger?.info(`📄 [splitPdf] Total pages: ${totalPages}`);

    const centerDir = path.join(SPLIT_OUTPUT_DIR, region.replace(/\s+/g, "_"));
    if (!fs.existsSync(centerDir)) {
      fs.mkdirSync(centerDir, { recursive: true });
    }

    const chunks: ChunkInfo[] = [];
    let chunkNumber = 1;

    for (let startIdx = 0; startIdx < totalPages; startIdx += PAGES_PER_CHUNK) {
      const endIdx = Math.min(startIdx + PAGES_PER_CHUNK, totalPages);
      
      const newPdf = await PDFDocument.create();
      const pageIndices: number[] = [];
      for (let p = startIdx; p < endIdx; p++) {
        pageIndices.push(p);
      }
      
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const fileName = `chunk_${chunkNumber}.pdf`;
      const filePath = path.join(centerDir, fileName);
      const pdfBytes = await newPdf.save();
      fs.writeFileSync(filePath, pdfBytes);

      chunks.push({
        chunkNumber,
        startPage: startIdx + 1,
        endPage: endIdx,
        fileName: filePath,
      });

      logger?.info(`✅ [splitPdf] Created ${fileName} (pages ${startIdx + 1}-${endIdx})`);
      chunkNumber++;
    }

    const metadata: CenterMetadata = {
      center: region,
      originalFile: pdfPath,
      totalPages,
      chunks,
      splitDate: new Date().toISOString(),
    };

    logger?.info(`✅ [splitPdf] Successfully split into ${chunks.length} chunks`);
    return metadata;
  } catch (error) {
    logger?.error(`❌ [splitPdf] Error splitting PDF:`, error);
    return null;
  }
}

function loadMetadata(): AllMetadata | null {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = fs.readFileSync(METADATA_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading metadata:", error);
  }
  return null;
}

function saveMetadata(metadata: AllMetadata) {
  if (!fs.existsSync(SPLIT_OUTPUT_DIR)) {
    fs.mkdirSync(SPLIT_OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf-8");
}

export function getChunkFiles(region: string): ChunkInfo[] {
  const metadata = loadMetadata();
  if (metadata && metadata.centers[region]) {
    return metadata.centers[region].chunks;
  }
  return [];
}

export function isCenterSplit(region: string): boolean {
  const metadata = loadMetadata();
  return !!(metadata && metadata.centers[region]);
}

export async function splitCenterPdf(region: string, logger?: any): Promise<{
  success: boolean;
  message: string;
  chunksCount: number;
  files: string[];
}> {
  logger?.info(`📂 [splitCenterPdf] Starting split for region: ${region}`);

  const pdfPath = PDF_FILES[region];
  if (!pdfPath) {
    logger?.error(`❌ [splitCenterPdf] Invalid region: ${region}`);
    return {
      success: false,
      message: `المنطقة غير صالحة: ${region}`,
      chunksCount: 0,
      files: [],
    };
  }

  if (isCenterSplit(region)) {
    const files = getChunkFiles(region);
    logger?.info(`✅ [splitCenterPdf] Region already split: ${files.length} chunks`);
    return {
      success: true,
      message: `تم تقسيم ملف ${region} مسبقاً إلى ${files.length} جزء`,
      chunksCount: files.length,
      files: files.map((f) => f.fileName),
    };
  }

  const centerMetadata = await splitPdfIntoChunks(region, pdfPath, logger);
  if (!centerMetadata) {
    return {
      success: false,
      message: `فشل في تقسيم ملف ${region}`,
      chunksCount: 0,
      files: [],
    };
  }

  let allMetadata = loadMetadata() || {
    centers: {},
    lastUpdated: new Date().toISOString(),
  };

  allMetadata.centers[region] = centerMetadata;
  allMetadata.lastUpdated = new Date().toISOString();
  saveMetadata(allMetadata);

  logger?.info(`✅ [splitCenterPdf] Successfully split into ${centerMetadata.chunks.length} chunks`);

  return {
    success: true,
    message: `تم تقسيم ملف ${region} إلى ${centerMetadata.chunks.length} جزء بنجاح`,
    chunksCount: centerMetadata.chunks.length,
    files: centerMetadata.chunks.map((c) => c.fileName),
  };
}

export const splitPdfBySubcommitteeTool = createTool({
  id: "split-pdf-by-subcommittee",
  description: `أداة لتقسيم ملف PDF الخاص بمركز انتخابي إلى ملفات أصغر للبحث بشكل أسرع.
  استخدم هذه الأداة عندما يختار المستخدم مركز للبحث فيه ولم يتم تقسيم الملف من قبل.`,

  inputSchema: z.object({
    region: z.enum(["مركز طما", "مركز طهطا", "قسم طهطا"]).describe("المركز المراد تقسيم ملفه"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    chunksCount: z.number(),
    files: z.array(z.string()),
  }),

  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const { region } = context;
    return splitCenterPdf(region, logger);
  },
});

export { PDF_FILES, SPLIT_OUTPUT_DIR, METADATA_FILE };
