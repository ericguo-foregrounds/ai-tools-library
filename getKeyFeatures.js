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
  
const featuresSchema = z.object({
    keyFeatures: z.array(bulletPoint),
});

const data = JSON.parse(fs.readFileSync('data/useCaseData.json', 'utf8'));

let currentIndex = 0;
const featuresData = [];

iterateData(); // starts the process

function iterateData() {
    if (currentIndex < data.length) { // recursive function structure, acts as for loop
        console.log(`${data.length - currentIndex} tools left to be processed.`);
        const tool = data[currentIndex];
        getKeyFeatures(tool)
            .then(res => {
                featuresData.push({name: tool.name, url: tool.url, desc: tool.desc, homepage: tool.homepage, useCases: tool.useCases, pricingLink: tool.pricingLink, ...res});
                currentIndex++;
                setTimeout(iterateData, 3000);
            })
            .catch(e => {
                console.log(e);
                featuresData.push({name: tool.name, url: tool.url, desc: tool.desc, homepage: tool.homepage, useCases: tool.useCases, pricingLink: tool.pricingLink, keyFeatures: ["Key features cannot be determined."]});
                currentIndex++;
                setTimeout(iterateData, 3000);
            })
    }
    else { // Once every url has been iterated through
        fs.writeFile('data/featuresData.json', JSON.stringify(featuresData, null, 2), (err) => {
            if (err) throw err;
            console.log('Features data saved.');
        });
    }
}

async function getKeyFeatures(tool) {
    console.log(`Now processing ${tool.url}`);
    let data = tool.homepage + tool.desc;
    // if there are feature links
    if (tool.featureLinks) {
        for(const link of tool.featureLinks) { // since featureLinks is an array, we need to iterate through it
            try {
                const jinaResponse = await axios.get(`https://r.jina.ai/${link}`);
                let text = jinaResponse.data;
                text = text.replace(/https?:\/\/\S+\b/g, ''); // Removes URLs
                text = text.replace(/\S+@\S+\.\S+/g, ''); // Removes email addresses
                // Remove extra whitespace and newlines
                text = text.replace(/\s+/g, ' ').trim();
                console.log("Jina scraped", link);
                data += text;
            }
            catch(e){
                console.log(`Error accessing ${link}`, e.status);
            }
        }
    }
    if(data.length > 20000) { // cuts prompt short - saves some money. 20000 chars is likely enough to determine key features
        data = data.substring(0, 20000);
    }
    // feed scraped data into LLM for it to determine key features
    try {
        const completion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful data analyst assistant for a company that is building an AI tools database." },
                {
                    role: "user",
                    content: `Given the text from an AI tool's webpage, determine the key features of that tool. Remember that our company's customers are mid- to top-level executives interested in using AI tools in their company. Use ONLY the data provided and DO NOT make assumptions based on prior knowledge. If the data is insufficient or missing, respond with "Key features cannot be determined." Otherwise, respond with ONE bullet point for each key feature, summarizing that feature. Data: ${data}`,
                },
            ],
            response_format: zodResponseFormat(featuresSchema, "features_response")
        });
    
        return completion.choices[0].message.parsed;
    }
    catch (e) {
        // Handle edge cases
        if (e.constructor.name == "LengthFinishReasonError") {
          // Retry with a higher max tokens
          console.log("Too many tokens: ", e.message);
          return ["Key features cannot be determined."];
        } else {
          // Handle other exceptions
          console.log("An error occurred: ", e.message);
          return ["Key features cannot be determined."];
        }
    }
}
