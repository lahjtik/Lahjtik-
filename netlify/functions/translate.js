exports.handler = async function (event) {
  // Only POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "طلب غير صالح" }) };
  }

  const { text, country, dialect, style } = body;

  if (!text || !country || !dialect || !style) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "بيانات ناقصة" }),
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

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", err);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "حدث خطأ، حاول لاحقاً" }),
      };
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "لم يرجع نص من الخادم" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "حدث خطأ، حاول لاحقاً" }),
    };
  }
};
