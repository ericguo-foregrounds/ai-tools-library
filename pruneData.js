
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
  
const prunedSchema = z.object({
    result: z.boolean(), // result is the boolean value - true for relevant false for irrelevant
    explanation: z.string() // if false, we're going to ask the LLM to provide us with a short explanation
});

const data = JSON.parse(fs.readFileSync('data/featuresData.json', 'utf8'));

let currentIndex = 0;
const prunedData = [];

iterateData(); // starts process

function iterateData() {
    if (currentIndex < data.length) { // recursive function structure - acts as for loop
        console.log(`${data.length - currentIndex} tools left to be processed.`);
        const tool = data[currentIndex];
        pruneTool(tool)
            .then(res => {
                console.log(res.result, res.explanation);
                if (res.result) { // if true (relevant) add tool to prunedData array
                    prunedData.push(tool);
                }
                currentIndex++;
                setTimeout(iterateData, 3000);
            })
            .catch(e => {
                console.log(e);
                prunedData.push(tool);
                currentIndex++;
                setTimeout(iterateData, 3000);
            })
    }
    else { // Once every url has been iterated through
        fs.writeFile('data/prunedData.json', JSON.stringify(prunedData, null, 2), (err) => {
            if (err) throw err;
            console.log('Pruned data saved.');
        });
    }
}

async function pruneTool(tool) {
    console.log(`Now processing ${tool.name}`);
    // converts useCases and keyFeatures arrays into strings to feed into the LLM
    let useCases = "";
    for (let useCase of tool.useCases) {
        useCases += `${useCase}, `;
    }

    let keyFeatures = "";
    for (let feature of tool.keyFeatures) {
        keyFeatures += `${feature}, `;
    }
    // prompts LLM
    try {
        const completion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an AI expert assisting The Foregrounds, a tech education company specializing in AI. Your task is to evaluate AI tools for inclusion in their comprehensive AI Tool Library. This library aims to help senior functional leaders understand and implement AI solutions in their organizations." },
                {
                    role: "user",
                    content: `Your objective: Assess each AI tool presented to you and determine its relevance for the AI Tool Library. 
                    Context: The library targets senior, non-technical leaders who are overwhelmed by the variety of AI tools available. The goal is to establish The Foregrounds as experts in AI executive education.
                    Your task: For each AI tool presented, you will receive: A description, Use cases, Key features.
                    Steps to follow: 1. Carefully read the provided information about the AI tool. 2. Consider if the tool would be valuable for senior functional leaders in organizations. 3. Evaluate if the tool aligns with The Foregrounds' mission of creating an "MBA for AI". 4. Determine if there's sufficient information to make a decision.
                    Response format: If the tool is relevant and there's enough information: Respond with "true". If the tool is not relevant or there's insufficient information: Respond with "false" and a one-sentence explanation.
                    Important: Provide only the boolean response ("true") without any additional explanation if the tool IS relevant, and the boolean response ("false") and a one-sentence explanation if the tool is NOT relevant.
                    Here are a few examples of tools that are irrelevant to the AI Tools library: 1. Simple AI-powered apps designed for general consumers, like basic photo editing apps with AI features, would probably not be relevant for organizational leadership. However, marketing tools, such as those related to ad development ARE relevant for our database. 2. Narrow, niche tools: AI tools designed for niche applications that aren't broadly applicable to various business functions might not be included, for example an AI tax-filing tool or an AI hairstyle-maker tool. Make sure that all tools can fit under one of the major functional area: Marketing, Finance, HR, Sales, Customer Success, Operations, Legal, Design, Product Management, General Management. 3. Tools with insufficient information: If the description, use cases, and key features provided don't give enough context to understand how the tool could be applied in a business setting, it would be marked as not relevant. 5. Non-AI tools: Any tools that don't actually incorporate AI or machine learning, even if they're related to data or technology, would not be relevant for this specific AI Tool Library.
                    Here is the tool: Description: ${tool.desc}, Use cases: ${useCases}, Key features: ${keyFeatures}`,
                },
            ],
            response_format: zodResponseFormat(prunedSchema, "result")
        });
    
        return completion.choices[0].message.parsed;
    }
    catch (e) {
        // Handle edge cases
        if (e.constructor.name == "LengthFinishReasonError") {
          // Retry with a higher max tokens
          console.log("Too many tokens: ", e.message);
          return true;
        } else {
          // Handle other exceptions
          console.log("An error occurred: ", e.message);
          return true;
        }
    }
}