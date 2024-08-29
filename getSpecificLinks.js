const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const data = JSON.parse(fs.readFileSync('data/enhancedData.json', 'utf8'));

const urls = data.map(tool => tool.link);

let processedTools = []; // array to put the data from processed tools
let currentIndex = 0; // will be used later

iterateData();
// uses cheerio to identify links that might contain useful information for us
async function scrapeWebsite(url) {
    console.log(`Processing ${url}...`);
    let useCaseLink = "";
    let pricingLink = "";
    let featureLinks = [];

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Attempts to find a use case link
        useCaseLink = $('a:contains("Use Cases"), a:contains("Features"), a:contains("Capabilities"), a:contains("How to use"), a.use-cases, a#use-cases, a.features').first().attr('href');
        if (useCaseLink) {
            useCaseLink = new URL(useCaseLink, url).href;
            console.log("use case link found", useCaseLink);
        }
        else {
            useCaseLink = "";
            console.log("use case link NOT found");
        }

        // Attempts to find a pricing link
        pricingLink = $('a:contains("Pricing"), a:contains("Subscription"), a:contains("Plans"), a:contains("Cost"), a:contains("Price"), a:contains("Fee"), a:contains("Free"), a.pricing, a.pricing-info, a.subscription, a.plans, a#pricing, a#plans').first().attr('href');
        if (pricingLink) {
            pricingLink = new URL(pricingLink, url).href;
            console.log("pricing link found", pricingLink);
        }
        else {
            pricingLink = "";
            console.log("pricing link NOT found");
        }

        // Attempts to find key features links - gets the href of each of those links
        featureLinks = $('a:contains("feature"), a:contains("Features"), a:contains("Capabilities"), a:contains("function"), a:contains("Functionality"), a:contains("tool"), a:contains("module"), a.features, a.capabilities, a.functions, a.functionality, a#features, a#capabilities')
        .map((index, element) => $(element).attr('href'))
        .get();
        if (featureLinks) {
            console.log("feature link found");
            featureLinks = featureLinks.map(link => new URL(link, url).href); // uses the href to make a URL
            featureLinks = featureLinks.filter((link, index) => featureLinks.indexOf(link) === index); // removes duplicate links
            console.log(featureLinks);
        }
        else {
            featureLinks = [];
            console.log("feature link NOT found");
        }

        return {useCaseLink: useCaseLink, pricingLink: pricingLink, featureLinks: featureLinks};
    }
    catch(err) {
        console.log(`Error with Axios in accessing ${url}.`);
        return {useCaseLink: "", pricingLink: "", featureLinks: []};
    }
}

function iterateData() {
    if (currentIndex < urls.length) { // recursive function - acts as a for loop
        const url = urls[currentIndex];
        const tool = data[currentIndex];

        scrapeWebsite(url)
            .then(data => {
                processedTools.push({ name: tool.name, url: url, desc: tool.desc, homepage: tool.homepage, ...data});
                currentIndex++;
                setTimeout(iterateData, 500); // Wait for .5 seconds before processing the next item
            })
            .catch(err => {
                console.log("Error processing link", err);
                processedTools.push({ name: tool.name, url: url, desc: tool.desc, homepage: "Homepage Data Missing", useCaseLink: "", pricingLink: "", featureLinks: []});
                currentIndex++;
                setTimeout(iterateData, 500); // Wait for .5 seconds before processing the next item
            })
    }
    else { // this means we've iterated through the entire array - we can write to csv file now.
        fs.writeFile('data/linkData.json', JSON.stringify(processedTools, null, 2), (err) => {
            if (err) throw err;
            console.log('Link data saved.');
        });
    }
}
