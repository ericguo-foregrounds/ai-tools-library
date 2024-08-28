const createCsvWriter = require('csv-writer').createObjectCsvWriter; // requires csv-writer package
const {Groq} = require('groq-sdk');
const fs = require('fs');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const csvWriter = createCsvWriter({ // creates csv writer object
    path: 'tooldata.csv',
    header: [
        { id: 'name', title: 'NAME' },
        { id: 'link', title: 'LINK' },
        { id: 'desc', title: 'DESCRIPTION' },
        { id: 'funcArea', title:'FUNCTIONAL-AREA'},
    ]
});

function buildPrompt(name, link, desc, homepage) {
    if (homepage.length >= 40000) {
      homepage = homepage.substring(0, 30000);
      console.log(`Homepage for ${name} was too long, had to be cut short.`);
    }
    let prompt = `Task: Given an AI tool's name, website link, a brief description, and scraped data from the tool's homepage, determine the primary functional area it serves. Input: Name: ${name}, Link: ${link}, Description: ${desc}, Homepage: ${homepage}. Instructions: Analyze the provided tool name, link, and description. 
          Identify the core functionality and target users of the AI tool.
          Classify the tool into ONE of the following functional areas: Marketing, Finance, HR, Sales, Customer Success, Operations, Legal, Design, Product Management, General Management. 
          Output ONLY the selected category and NOTHING ELSE. Here is an example: Name: Drift
          Link: https://www.drift.com/?utm_source=insidrai
          Description: Drift is an AI-powered buyer engagement platform that automates conversations with website visitors to personalize experiences, qualify leads, and increase sales efficiency using conversational marketing and sales tools. Expected Output: Sales.
          Homepage Scraped Data: Identify website visitors and understand their intent to deliver personalized experiences that qualify and mature them down the funnel.
          Notes: Please analyze the tool description and the homepage data (if the prompt contains homepage data) to make an informed decision. Do not rely solely on prior knowledge or assumptions. Respond with ONLY the functional area and NOTHING ELSE.`
    console.log("Prompt length", prompt.length);
    return prompt;
}

async function getFuncArea(name, link, desc, homepage) {
    return groq.chat.completions.create({
        messages: [
            {
                role: "user",
                content: buildPrompt(name, link, desc, homepage),
            },
        ],
        model: "llama3-8b-8192",
    });
}


async function main(tool) { // this is what we will be running
    const name = tool.name;
    const link = tool.link;
    const desc = tool.desc;
    const homepage = tool.homepage;
    const funcAreaResponse = await getFuncArea(name, link, desc, homepage);
    return {name: name, link: link, desc: desc, funcArea: (funcAreaResponse.choices[0]?.message?.content || "Error with funcArea")};
}

const data = JSON.parse(fs.readFileSync('enhancedData.json', 'utf8'));
const newData = []; // new data with functional area 

let currentIndex = 0; // current index of data

function iterateData() {
    if(currentIndex < data.length) {
        const tool = data[currentIndex];
        main(tool).then(res => { // object we get back from main
            newData.push(res);
            currentIndex++;
            setTimeout(iterateData, 5000);
        }).catch(err => {
            console.log(`Error with Groq at ${tool.name}`, err);
            currentIndex++;
            setTimeout(iterateData, 5000);
        });
    }
    else {
        csvWriter.writeRecords(newData).then(() => {
            console.log("Written to CSV file");
        }).catch(err => {
            console.log("Cannot write to CSV file", err);
        })
    }
}

iterateData(); // starts the process



  