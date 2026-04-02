const https = require("https");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "طلب غير صالح" }) };
  }

  const { text, country, style } = body;
  const dialect = body.dialect || country;

  if (!text || !country || !style) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: "بيانات ناقصة: text او country او style" }),
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "GROQ_API_KEY غير موجود" }),
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
    model: "llama-3.3-70b-versatile",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

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
          // أرجع الخطأ الكامل من Groq
          if (res.statusCode !== 200) {
            let groqMsg = data;
            try {
              const parsedErr = JSON.parse(data);
              groqMsg = parsedErr.error?.message || parsedErr.error || data;
            } catch {}
            console.error("Groq error:", res.statusCode, data);
            resolve({
              statusCode: 502,
              headers: CORS,
              body: JSON.stringify({ error: `Groq ${res.statusCode}: ${groqMsg}` }),
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
          resolve({
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: "خطأ في معالجة الرد: " + parseErr.message }),
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "فشل الاتصال: " + err.message }),
      });
    });

    req.write(requestBody);
    req.end();
  });
};
