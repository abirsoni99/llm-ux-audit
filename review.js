require("dotenv").config();
const fs = require("fs");
const axios = require("axios");

async function runReview(input) {

  let firstFold, fullPage, url, device;

  // -------- LOCAL MODE --------
  if (!input) {
    firstFold = fs.readFileSync("first-fold.png").toString("base64");
    fullPage = fs.readFileSync("full-page.png").toString("base64");
    url = "Local capture";
    device = "desktop";
  }
  // -------- API MODE (Lovable) --------
  else {
    firstFold = input.firstFold;
    fullPage = input.fullPage;
    url = input.url;
    device = input.device;
  }

  const prompt = `
You are a senior UX auditor reviewing a B2B marketplace page.

Page URL: ${url}
Device: ${device}

Evaluate:

1. Information hierarchy
2. Navigation clarity
3. CTA effectiveness
4. Trust signals
5. Cognitive load
6. Conversion friction
7. Visual consistency

Give concrete actionable improvements.
`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert B2B UX consultant." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: data:image/png;base64,${firstFold} } },
            { type: "image_url", image_url: { url: data:image/png;base64,${fullPage} } }
          ]
        }
      ],
      max_tokens: 1500
    },
    {
      headers: {
        Authorization: Bearer ${process.env.OPENAI_API_KEY},
        "Content-Type": "application/json"
      }
    }
  );

  console.log("\n===== UX AUDIT =====\n");
  console.log(response.data.choices[0].message.content);
}

module.exports = runReview;

// allow standalone usage
if (require.main === module) {
  runReview();
}