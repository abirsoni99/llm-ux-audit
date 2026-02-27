require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const API_URL = "https://imllm.intermesh.net/v1/chat/completions";
const TOKEN = process.env.IMLLM_TOKEN;

async function review(imagePath){

  // convert screenshot → base64
  const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

  const body = {
    model: "google/gemini-2.5-pro",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
You are a real B2B buyer in India using a marketplace like IndiaMART to source products for your business.

You are NOT a product manager.
You are NOT a UX designer.
You are a cautious buyer trying to decide whether to enquire, call, or compare suppliers.

You are viewing a screenshot of either a Search Results Page (SRP) or Product Detail Page (PDP).

Evaluate the interface from YOUR perspective as a buyer.

For each metric below, provide:

• Score (1–10)
• What makes you hesitate
• What would increase your confidence
• Would you enquire / compare more / leave?

---

1) First Impression Clarity  
Within 5 seconds, do you understand what you are looking at?

2) Decision Confidence  
Do you feel confident this product/supplier is genuine?

3) Trust & Risk Perception  
Do ratings, badges, GST info, tenure reduce your risk?
Or do you still feel unsure?

4) Price & Value Understanding  
Do you understand pricing clearly?
Is it transparent or ambiguous?

5) Comparison Ease  
Can you easily compare multiple suppliers?
Or does the layout slow you down?

6) Action Clarity  
Is it obvious what will happen if you click?
Do you prefer Call or Get Best Price?
Are both confusing?

7) Information Overload  
Do you feel overwhelmed?
Is too much information shown at once?

8) Content Clarity  
Are product specs understandable?
Do you feel you need to call to clarify basics?

9) Navigation Comfort  
Do you know how to refine your search?
Can you find filters easily?

10) Overall Buying Readiness  
At this stage, would you:
- Immediately enquire?
- Shortlist?
- Scroll further?
- Exit?

---

After scoring, provide:

A) Overall Buyer Confidence Score (1–10)

B) Top 3 reasons you might hesitate

C) What would make you enquire immediately

D) Does this page feel trustworthy for business purchase?

Important:
- Answer like a practical, price-sensitive Indian B2B buyer.
- Do NOT use UX jargon.
- Speak in simple, direct reasoning.
- Be honest about doubt and hesitation.
`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`
            }
          }
        ]
      }
    ],
    temperature: 0.2
  };

  try {
    const res = await axios.post(API_URL, body, {
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      timeout: 120000
    });

    console.log("\n========= REVIEW:", imagePath, "=========\n");
    console.log(res.data.choices[0].message.content);

  } catch (err) {
    console.log("ERROR:");
    console.log(err.response?.data || err.message);
  }
}

(async()=>{
  await review("srp.png");
  await review("pdp.png");
})();