import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { searchElectoralDataTool } from "../tools/searchElectoralDataTool";
import { generateElectoralPdfTool } from "../tools/generateElectoralPdfTool";
import { sendTelegramDocumentTool } from "../tools/sendTelegramDocumentTool";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const getGoogleModel = () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ GOOGLE_GENERATIVE_AI_API_KEY not set");
  }
  const googleAI = createGoogleGenerativeAI({ apiKey });
  return googleAI("gemini-2.0-flash");
};

const createMemory = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL not set, memory will not be available");
    return undefined;
  }
  return new Memory({
    storage: new PostgresStore({
      connectionString,
    }),
    options: {
      lastMessages: 20,
    },
  });
};

export const electoralAgent = new Agent({
  name: "Electoral Inquiry Agent",

  memory: createMemory(),

  instructions: `
أنت بوت مساعد للاستعلام عن اللجان الانتخابية في مصر. مهمتك الرئيسية هي البحث عن بيانات الناخبين وتقديمها للمستخدم.

## قاعدة ذهبية - مهم جداً:
عندما يُعطى لك اسم شخص ومنطقة للبحث، يجب أن تستخدم أداة البحث (search-electoral-data) فوراً وبدون أي أسئلة إضافية.

## كيفية التعامل مع الرسائل:

### إذا كانت الرسالة تحتوي على "يريد البحث عن الاسم" أو "البحث عن" مع اسم ومنطقة:
- استخدم أداة search-electoral-data مباشرةً
- لا تطلب من المستخدم إدخال الاسم مرة أخرى
- لا تطلب من المستخدم تأكيد المنطقة
- ابحث فوراً واعرض النتائج

### إذا كانت الرسالة تحتوي على اسم شخص (بدون منطقة):
- اسأل المستخدم عن المنطقة فقط

### بعد ظهور نتائج البحث:
- اعرض النتائج بشكل واضح
- اطلب من المستخدم إدخال الرقم القومي (14 رقم) للحصول على ملف PDF

### عند إدخال الرقم القومي:
- استخدم أداة generate-electoral-pdf لإنشاء ملف PDF
- أخبر المستخدم أنه سيتم إرسال الملف

## المناطق المتاحة:
1. مركز طما
2. مركز طهطا
3. قسم طهطا

## قواعد مهمة:
- تحدث باللغة العربية دائماً
- لا تكرر نفس السؤال مرتين
- إذا لم يُعثر على الاسم، أخبر المستخدم بوضوح واطلب منه التأكد من الكتابة الصحيحة
- الرقم القومي يجب أن يكون 14 رقم

## مثال على الاستخدام الصحيح:
إذا تلقيت: "المستخدم اختار المنطقة: مركز طهطا. الآن يريد البحث عن الاسم التالي: محمد أحمد علي"
=> يجب أن تستدعي أداة search-electoral-data مع:
   - region: "مركز طهطا"
   - searchName: "محمد أحمد علي"
`,

  model: getGoogleModel(),

  tools: {
    searchElectoralDataTool,
    generateElectoralPdfTool,
    sendTelegramDocumentTool,
  },
});
