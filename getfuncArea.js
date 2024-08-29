const fs = require("fs");
const { OpenAI } = require("openai");
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");

require('dotenv').config();

// creates new OpenAI object
const openai = new OpenAI(
    { apiKey: process.env.OPENAI_API_KEY }
);

// Creates schema for structured output
const funcAreaSchema = z.object({
    funcArea: z.string(),
});

const data = JSON.parse(fs.readFileSync('data/pricingData.json', 'utf8'));

let currentIndex = 0;
const finalData = [];

iterateData();

function iterateData() {
    if (currentIndex < data.length) {
        console.log(`${data.length - currentIndex} tools left to be processed.`);
        const tool = data[currentIndex];
        getFuncArea(tool)
            .then(res => {
                finalData.push({ name: tool.name, url: tool.url, desc: tool.desc, useCases: tool.useCases, keyFeatures: tool.keyFeatures, pricingModel: tool.pricingModel, ...res });
                currentIndex++;
                setTimeout(iterateData, 1000);
            })
            .catch(e => {
                console.log(e);
                finalData.push({ name: tool.name, url: tool.url, desc: tool.desc, useCases: tool.useCases, keyFeatures: tool.keyFeatures, pricingModel: tool.pricingModel, funcArea: "Functional area cannot be determined."});
                currentIndex++;
                setTimeout(iterateData, 1000);
            })
    }
    else { // Once every url has been iterated through
        fs.writeFile('data/funcAreaData.json', JSON.stringify(finalData, null, 2), (err) => {
            if (err) throw err;
            console.log('Final data with funcArea saved.');
        });
    }
}

async function getFuncArea(tool) {
    console.log(`Now processing ${tool.name}`);

    let useCases = "";
    for (let useCase of tool.useCases) {
        useCases += `${useCase}, `;
    }

    let keyFeatures = "";
    for (let feature of tool.keyFeatures) {
        keyFeatures += `${feature}, `;
    }
    if (data.length > 15000) {
        data = data.substring(0, 15000);
    }

    try {
        const completion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful data analyst assistant for a company that is building an AI tools database." },
                {
                    role: "user",
                    content: `Task: Given an AI tool's brief description, scraped data from the tool's homepage, use cases, and key features, determine the primary functional area it serves. Input:: Description: ${tool.desc}, Homepage: ${tool.homepage}, Use cases: ${useCases}, Key features: ${keyFeatures}. 
                    Instructions: Analyze the provided tool description, homepage data, use cases, and key features. Identify the core functionality and target users of the AI tool. Classify the tool into ONE of the following functional areas: Marketing, Finance, HR, Sales, Customer Success, Operations, Legal, Design, Product Management, General Management.
                    Definitions: Marketing: Definition: The function responsible for promoting and selling products or services.
                    AI tool focus: Tools that assist in market analysis, customer segmentation, content creation, campaign optimization, and personalization of marketing efforts.
                    Finance:
                    Definition: The function that manages the company's money, including financial planning, risk management, and accounting.
                    AI tool focus: Tools for financial forecasting, fraud detection, algorithmic trading, risk assessment, and automated reporting.
                    HR (Human Resources):
                    Definition: The function that manages the company's workforce, including recruitment, employee development, and workplace policies.
                    AI tool focus: Tools for resume screening, candidate matching, employee sentiment analysis, performance prediction, and personalized learning recommendations.
                    Sales:
                    Definition: The function responsible for directly selling products or services to customers.
                    AI tool focus: Tools for lead scoring, sales forecasting, chatbots for initial customer interactions, pricing optimization, and sales performance analytics.
                    Customer Success:
                    Definition: The function that ensures customers achieve their desired outcomes while using the company's product or service.
                    AI tool focus: Tools for predicting customer churn, personalizing customer interactions, automating support tickets, and analyzing customer feedback.
                    Operations:
                    Definition: The function that oversees the day-to-day activities and processes within the organization.
                    AI tool focus: Tools for process optimization, predictive maintenance, supply chain management, quality control, and resource allocation.
                    Legal:
                    Definition: The function that handles legal matters and ensures compliance with laws and regulations.
                    AI tool focus: Tools for contract analysis, legal research, compliance monitoring, intellectual property management, and due diligence automation.
                    Design:
                    Definition: The function responsible for creating visual and functional aspects of products, services, or marketing materials.
                    AI tool focus: Tools for generative design, A/B testing, user experience optimization, and automated graphic design.
                    Product Management:
                    Definition: The function that guides the development, launch, and improvement of products or services.
                    AI tool focus: Tools for market trend analysis, feature prioritization, user behavior prediction, product analytics, and roadmap optimization.
                    General Management:
                    Definition: The overarching function that coordinates all other functions and sets the overall strategy for the organization.
                    AI tool focus: Tools for strategic decision-making, scenario planning, performance dashboards, competitive intelligence, and cross-functional collaboration. 
                    Output ONLY the selected category and NOTHING ELSE. Notes: Please analyze the provided data to make an informed decision. Do not rely solely on prior knowledge or assumptions. Respond with ONLY the functional area and NOTHING ELSE. If there is not enough information to determine a function area, respond with "Functional area cannot be determined."`,
                },
            ],
            response_format: zodResponseFormat(funcAreaSchema, "funcArea_response")
        });

        return completion.choices[0].message.parsed;
    }
    catch (e) {
        // Handle edge cases
        if (e.constructor.name == "LengthFinishReasonError") {
            // Retry with a higher max tokens
            console.log("Too many tokens: ", e.message);
            return "Functional area cannot be determined.";
        } else {
            // Handle other exceptions
            console.log("An error occurred: ", e.message);
            return "Functional area cannot be determined.";
        }
    }
}
