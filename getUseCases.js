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
  
const useCasesSchema = z.object({
    useCases: z.array(bulletPoint),
});

const data = JSON.parse(fs.readFileSync('data/linkData.json', 'utf8'));

let currentIndex = 0;
const finalData = [];

iterateData();

function iterateData() {
    if (currentIndex < data.length) {
        const tool = data[currentIndex];
        getUseCase(tool)
            .then(res => {
                finalData.push({name: tool.name, url: tool.url, desc: tool.desc, homepage: tool.homepage, pricingLink: tool.pricingLink, featureLinks: tool.featureLinks, ...res});
                currentIndex++;
                setTimeout(iterateData, 3000);
            })
            .catch(e => {
                console.log(e);
                finalData.push({name: tool.name, url: tool.url, desc: tool.desc, homepage: tool.homepage, pricingLink: tool.pricingLink, featureLinks: tool.featureLinks, useCases: ["Use cases cannot be determined."]});
                currentIndex++;
                setTimeout(iterateData, 3000);
            })
    }
    else { // Once every url has been iterated through
        fs.writeFile('data/useCaseData.json', JSON.stringify(finalData, null, 2), (err) => {
            if (err) throw err;
            console.log('Final use casedata saved.');
        });
    }
}

async function getUseCase(tool) {
    console.log(`Now processing ${tool.url}`);
    let data = tool.homepage + tool.desc;
    // if a use case link exists
    if (tool.useCaseLink) {
        try {
            const jinaResponse = await axios.get(`https://r.jina.ai/${tool.useCaseLink}`); // use jina to scrape that link
            let text = jinaResponse.data;
            console.log("Jina scraped", tool.useCaseLink);
            text = text.replace(/https?:\/\/\S+\b/g, ''); // Removes URLs
            text = text.replace(/\S+@\S+\.\S+/g, ''); // Removes email addresses
            // Remove extra whitespace and newlines
            text = text.replace(/\s+/g, ' ').trim();
            data += text;
        }
        catch(e){
            console.log(`Error accessing ${tool.useCaseLink}`, e.status);
        }
    }
    if(data.length > 15000) {
        data = data.substring(0, 15000);
    }
    // feed scraped data into LLM for it to determine use cases
    try {
        const completion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful data analyst assistant for a company that is building an AI tools database." },
                {
                    role: "user",
                    content: `Given the text from an AI tool's webpage, determine the tool's use case. Remember that our company's customers are mid- to top-level executives interested in using AI tools in their company. Use ONLY the data provided and DO NOT make assumptions based on prior knowledge. If the data is insufficient or missing, respond with "Use cases cannot be determined." Otherwise, respond with bullet points summarizing the use cases that match our customers and NOTHING ELSE. Data: ${data}`,
                },
            ],
            response_format: zodResponseFormat(useCasesSchema, "usecase_response")
        });
    
        return completion.choices[0].message.parsed;
    }
    catch (e) {
        // Handle edge cases
        if (e.constructor.name == "LengthFinishReasonError") {
          // Retry with a higher max tokens
          console.log("Too many tokens: ", e.message);
          return ["Use cases cannot be determined."];
        } else {
          // Handle other exceptions
          console.log("An error occurred: ", e.message);
          return ["Use cases cannot be determined."];
        }
      }
}
