const axios = require("axios");
const fs = require("fs");
const { OpenAI } = require("openai");
const {zodResponseFormat} = require("openai/helpers/zod");
const {z} = require("zod");

require('dotenv').config();

// creates new OpenAI object
const openai = new OpenAI(
    { apiKey: process.env.OPENAI_API_KEY }
);

// Creates schema for structured output
const bulletPoint = z.string();
  
const pricingSchema = z.object({
    pricingModel: z.array(bulletPoint),
});

const data = JSON.parse(fs.readFileSync('data/prunedData.json', 'utf8'));

let currentIndex = 0;
const finalData = [];

iterateData();

function iterateData() {
    if (currentIndex < data.length) {
        console.log(`${data.length - currentIndex} tools left to be processed.`);
        const tool = data[currentIndex];
        getPricingModel(tool)
            .then(res => {
                finalData.push({name: tool.name, url: tool.url, desc: tool.desc, homepage: tool.homepage, useCases: tool.useCases, keyFeatures: tool.keyFeatures, ...res});
                currentIndex++;
                setTimeout(iterateData, 1000);
            })
            .catch(e => {
                console.log(e);
                finalData.push({name: tool.name, url: tool.url, desc: tool.desc, homepage: tool.homepage, useCases: tool.useCases, keyFeatures: tool.keyFeatures, pricingModel: ["Pricing model cannot be determined."]});
                currentIndex++;
                setTimeout(iterateData, 1000);
            })
    }
    else { // Once every url has been iterated through
        fs.writeFile('data/pricingData.json', JSON.stringify(finalData, null, 2), (err) => {
            if (err) throw err;
            console.log('Final pricing data saved.');
        });
    }
}

async function getPricingModel(tool) {
    console.log(`Now processing ${tool.url}`);
    let data = tool.homepage + tool.desc;

    if (tool.pricingLink) {
        try {
            const jinaResponse = await axios.get(`https://r.jina.ai/${tool.pricingLink}`);
            let text = jinaResponse.data;
            text = text.replace(/https?:\/\/\S+\b/g, ''); // Removes URLs
            text = text.replace(/\S+@\S+\.\S+/g, ''); // Removes email addresses
            // Remove extra whitespace and newlines
            text = text.replace(/\s+/g, ' ').trim();
            console.log("Jina scraped", tool.pricingLink);
            data += text;
        }
        catch(e){
            console.log(`Error accessing ${tool.pricingLink}`, e.status);
        }
    }
    if(data.length > 15000) {
        data = data.substring(0, 15000);
    }

    try {
        const completion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful data analyst assistant for a company that is building an AI tools database." },
                {
                    role: "user",
                    content: `Given the text from an AI tool's webpage, determine the pricing model for that tool. Use ONLY the data provided and DO NOT make assumptions based on prior knowledge. If the data is insufficient or missing, respond with "Pricing model cannot be determined." Otherwise, respond with ONE bullet point for each pricing tier or model or plan for the tool that summarizes that tier/model/plan. For example, if Tool A has a free plan, premium plan, and business plan, there will be one bullet point summarizing the free plan, one summarizing the premium plan, and one summarizing the business plan. Data: ${data}`,
                },
            ],
            response_format: zodResponseFormat(pricingSchema, "pricing_response")
        });
    
        return completion.choices[0].message.parsed;
    }
    catch (e) {
        // Handle edge cases
        if (e.constructor.name == "LengthFinishReasonError") {
          // Retry with a higher max tokens
          console.log("Too many tokens: ", e.message);
          return ["Pricing model cannot be determined."];
        } else {
          // Handle other exceptions
          console.log("An error occurred: ", e.message);
          return ["Pricing model cannot be determined."];
        }
      }
}
