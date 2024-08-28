const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.
const createCsvWriter = require('csv-writer').createObjectCsvWriter; // requires csv-writer package
const {Groq} = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main(name, link, desc, scraped) {
  const funcAreaResponse = await getFuncArea(name, link, desc, scraped);
  return {funcArea: (funcAreaResponse.choices[0]?.message?.content || "Error with funcArea")};
}

async function scrapeWebsite(link) {
  try {
    const response = await axios.get(`https://r.jina.ai/${link}`);
    let text = response.data;
    console.log("scraped", link);
    text = text.replace(/https?:\/\/\S+\b/g, ''); // Removes URLs
    text = text.replace(/\S+@\S+\.\S+/g, ''); // Removes email addresses
    text = text.trim();
    console.log(`The scraped website homepage is ${text.length} characters`);
    return text;
  }
  catch(err) {
    console.log("JinaAI error scraping website", err);
    return "";
  }
}

function buildPrompt(name, link, desc, scraped) {
  console.log(scraped);
  if (scraped.length >= 40000) {
    scraped = scraped.substring(0, 35000);
    console.log(scraped);
  }
  let prompt = `Task: Given an AI tool's name, website link, a brief description, and scraped data from the tool's homepage, determine the primary functional area it serves. Input: Name: ${name}, Link: ${link}, Description: ${desc}, Homepage: ${scraped}. Instructions: Analyze the provided tool name, link, and description. 
        Identify the core functionality and target users of the AI tool.
        Classify the tool into ONE of the following functional areas: Marketing, Finance, HR, Sales, Customer Success, Operations, Legal, Design, Product Management, General Management. 
        Output ONLY the selected category. Here is an example: Tool Name: Drift
        Tool Link: https://www.drift.com/?utm_source=insidrai
        Tool Description: Drift is an AI-powered buyer engagement platform that automates conversations with website visitors to personalize experiences, qualify leads, and increase sales efficiency using conversational marketing and sales tools. Expected Output: Sales.
        Tool Homepage Scraped Data: Identify website visitors and understand their intent to deliver personalized experiences that qualify and mature them down the funnel.
        Notes: Please analyze the tool description and the homepage data (if the prompt contains homepage data) to make an informed decision. Do not rely solely on prior knowledge or assumptions. Respond with ONLY the functional area and NOTHING ELSE.`
  console.log("Prompt length", prompt.length);
  return prompt;
}

async function getFuncArea(name, link, desc, scraped) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: buildPrompt(name, link, desc, scraped),
      },
    ],
    model: "llama3-8b-8192",
  });
}

(async () => {
    const browser = await chromium.launch(); // launches Chromium
    const page = await browser.newPage();

    const numPages = 41; // number of pages we want to scrape
    const baseUrl = "https://www.insidr.ai/ai-tools/page/" // will be used in the for loop

    const csvWriter = createCsvWriter({ // creates csv writer object
        path: 'tooldata.csv',
        header: [
            { id: 'name', title: 'NAME' },
            { id: 'link', title: 'LINK' },
            { id: 'desc', title: 'DESCRIPTION' },
            { id: 'funcArea', title:'FUNCTIONAL-AREA'},
        ]
    });


    const data = []; // array to put all of the data we scrape

    // localized test
    await page.goto('https://www.insidr.ai/ai-tools/page/21/', {timeout: 90000});
    console.log("page loaded");

    const tools = await page.locator('.aitools-item').all();
    const names = await page.locator('.aitools-tool-title').all();
    const links = await page.locator('.aitools-visit-link').all();
    const descriptions = await page.locator('.aitools-tool-description').all();

    for (let i = 0; i < tools.length; i++) { // for each of the tools on the page
        const name = await names[i].innerText();
        const desc = await descriptions[i].innerText();
        let link = ""; // link is the link to the tool
        let scraped = ""; // scraped is what we collect from Jina AI
        if ((await tools[i].innerText()).includes("Visit tool") === false) {
            link = "Link Missing";
        }
        else {
            link = await links[0].getAttribute("href");
            scraped = await scrapeWebsite(link);
            links.shift();
        }
        const {funcArea} = await main(name, link, desc, scraped);
        
        data.push({name: name, link: link, desc: desc, funcArea: funcArea});
    }

    console.log(JSON.stringify(data));

    fs.writeFile('scrapedData.json', JSON.stringify(data, null, 2), (err) => {
        if (err) throw err;
        console.log('Data saved.');
    });

    const rawData = JSON.parse(fs.readFileSync('scrapedData.json', 'utf8'));
    console.log(rawData);


    // for (let pageNum = 1; pageNum <= numPages; pageNum++) { // solves pagination issue
    //     const url = `${baseUrl}${pageNum}/`;

    //     try {
    //         await page.goto(url, {timeout: 90000}); // sometimes Insidr AI's pages won't load - this sets a timeout of 1 min 30 s for a page to load
    //         console.log(`Now on page ${pageNum}`); // console.logs throughout to notify which step you're on in the terminal
    //         const tools = await page.locator('.aitools-item').all(); // on Insidr's page, each tool has its own div container. This will find all of the container divs on a page
    //         const names = await page.locator('.aitools-tool-title').all(); // finds all names of tools on page
    //         const links = await page.locator('.aitools-visit-link').all(); // finds all links of tools on page, if a link is provided
    //         const descriptions = await page.locator('.aitools-tool-description').all(); // finds all descriptions of tools on page

    //         for (let i = 0; i < tools.length; i++) { // for the current page being scraped
    //             const name = await names[i].innerText(); 
    //             const desc = await descriptions[i].innerText();
    //             let link = ""; // link is the link to the tool
    //             let scraped = ""; // scraped is what we collect from Jina AI
    //             // if a link is present, there will be a "visit tool" button, checks if one is present for each tool div
    //             if ((await tools[i].innerText()).includes("Visit tool") === false) { 
    //                 console.log("Link Missing"); // Will alert in terminal if tool is missing link
    //                 link = "Link Missing";
    //             }
    //             else { // if links are missing on the page, the array links.length !== tools.length
    //               link = await links[0].getAttribute("href");
    //               scraped = await scrapeWebsite(link);
    //               links.shift(); // since we're going sequentially through the tools, if link is present, remove it from links array after it has been added to csv.
    //               // this way we won't need two for loops
    //             }
    //             const {funcArea} = await main(name, link, desc, scraped);
    //             data.push({name: name, link: link, desc: desc, funcArea: funcArea});
    //         }
    //         console.log(`Page ${pageNum} done`); 
    //     }
    //     catch(err) { // if error
    //         console.log(`Error on Page ${pageNum}`, err); // tells us where error occurred
    //         await browser.close();
    //     }
    // }

    // await csvWriter.writeRecords(data);
    // console.log("Written to CSV file");
    await browser.close();
})();


