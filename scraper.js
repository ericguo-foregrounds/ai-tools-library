const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.
const fs = require('fs');

(async () => {
    const browser = await chromium.launch(); // launches Chromium
    const page = await browser.newPage();

    const numPages = 41; // number of pages we want to scrape
    const baseUrl = "https://www.insidr.ai/ai-tools/page/" // will be used in the for loop

    const data = []; // array to put all of the data we scrape

    for (let pageNum = 1; pageNum <= numPages; pageNum++) { // solves pagination issue
        const url = `${baseUrl}${pageNum}/`;

        try {
            await page.goto(url, {timeout: 90000}); // sometimes Insidr AI's pages won't load - this sets a timeout of 1 min 30 s for a page to load
            console.log(`Now on page ${pageNum}`); // console.logs throughout to notify which step you're on in the terminal
            const tools = await page.locator('.aitools-item').all(); // on Insidr's page, each tool has its own div container. This will find all of the container divs on a page
            const names = await page.locator('.aitools-tool-title').all(); // finds all names of tools on page
            const links = await page.locator('.aitools-visit-link').all(); // finds all links of tools on page, if a link is provided
            const descriptions = await page.locator('.aitools-tool-description').all(); // finds all descriptions of tools on page

            for (let i = 0; i < tools.length; i++) { // for the current page being scraped
                const name = await names[i].innerText({timeout: 90000}); 
                const desc = await descriptions[i].innerText({timeout: 90000});
                let link = ""; // link is the link to the tool
                // if a link is present, there will be a "visit tool" button, checks if one is present for each tool div
                if ((await tools[i].innerText()).includes("Visit tool") === false) { 
                    console.log("Link Missing"); // Will alert in terminal if tool is missing link
                    link = "Link Missing";
                }
                else { // if links are missing on the page, the array links.length !== tools.length
                    try { // error might occur when going to new page (dead link)
                        link = await links[0].getAttribute("href", {timeout: 90000});
                        await page.goto(link, {timeout: 90000});
                        link = page.url();
                    }
                    catch(err) {
                        link = "Link Missing";
                        console.log("Possible Dead Link", err);
                    }
                    links.shift(); // since we're going sequentially through the tools, if link is present, remove it from links array after it has been added to csv.
                    // this way we won't need two for loops
                    await page.goto(url, {timeout: 90000}); // goes back to the insidr link to collect info about the next tool
                }
                data.push({name: name, link: link, desc: desc});
            }
            console.log(`Page ${pageNum} done`); 
        }
        catch(err) { // if error
            console.log(`Error on Page ${pageNum}`, err); // tells us where error occurred
        }
    }
    await browser.close();

    fs.writeFile('data/scrapedData.json', JSON.stringify(data, null, 2), (err) => {
        if (err) throw err;
        console.log('Data saved.');
    });
})();
