const https = require("https");

// CORS headers لكل الردود
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async function (event) {
  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "طلب غير صالح" }) };
  }

  const { text, country, style } = body;
  // dialect اختياري — نستخدم country كبديل إذا لم يُرسَل
  const dialect = body.dialect || country;

  // التحقق من الحقول الأساسية فقط
  if (!text || !country || !style) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "بيانات ناقصة: text أو country أو style" }),
    };
  }

  // التحقق من وجود API Key
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY غير موجود في Environment Variables");
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "خطأ في إعداد الخادم" }),
    };
  }

  const prompt = `أنت خبير في الأساليب الكتابية والثقافات العربية المتنوعة.

مهمتك: أعد كتابة النص بأسلوب ${style} يناسب ثقافة ${country} (${dialect}).

القواعد:
- حافظ على المعنى الأصلي تماماً بدون إضافة أو حذف
- استخدم المفردات والتعابير الشائعة في ${country}
- اجعل النص طبيعياً كأن ابن ${country} كتبه
- للأسلوب الرسمي: أضف تحية وختام مناسبَين لثقافة ${country}
- للأسلوب الودي والواتساب: استخدم العامية المحلية المألوفة
- للتسويق: استخدم أسلوب الإقناع المؤثر في ${country}
- لا تكتب أي شرح أو مقدمة، فقط النص المحوّل مباشرة

النص:
${text}`;

  const requestBody = JSON.stringify({
    model: "llama3-70b-8192",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  // استخدام https مباشرة بدل fetch لضمان العمل في كل إصدارات Node
  return new Promise((resolve) => {
    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          if (res.statusCode !== 200) {
            console.error("Groq API error:", res.statusCode, data);
            resolve({
              statusCode: 502,
              headers: CORS,
              body: JSON.stringify({ error: `خطأ من Groq: ${res.statusCode}` }),
            });
            return;
          }

          const parsed = JSON.parse(data);
          const result = parsed.choices?.[0]?.message?.content?.trim();

          if (!result) {
            resolve({
              statusCode: 502,
              headers: CORS,
              body: JSON.stringify({ error: "لم يرجع نص من الخادم" }),
            });
            return;
          }

          resolve({
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ result }),
          });

        } catch (parseErr) {
          console.error("Parse error:", parseErr);
          resolve({
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: "خطأ في معالجة الرد" }),
          });
        }
      });
    });

    req.on("error", (err) => {
      console.error("Request error:", err);
      resolve({
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "فشل الاتصال بالخادم" }),
      });
    });

    req.write(requestBody);
    req.end();
  });
};
