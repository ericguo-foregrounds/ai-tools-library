const fs = require("fs");

const data = JSON.parse(fs.readFileSync('data/funcAreaData.json', 'utf8'));

// const testData = [{ name: "Notion", url: "https://www.notion.so/product?via=insidrai&utm_source=affl&utm_medium=lasselinnes1376&pscd=affiliate.notion.so&ps_partner_key=bGFzc2VsaW5uZXMxMzc2&ps_xid=e7t47x1gwCLqiV&gsxid=e7t47x1gwCLqiV&gspk=bGFzc2VsaW5uZXMxMzc2" }, { name: "Notion.so", url: "https://www.notion.so/product" }, { name: "AliceBlue", url: "https://nando.ai/?ref=ntywmtm" }];

const newData = removeQueryParams(data);

const finalData = removeDuplicates(newData);
console.log(finalData);

fs.writeFile('data/finalData.json', JSON.stringify(finalData, null, 2), (err) => {
    if (err) throw err;
    console.log('Final pricing data saved.');
});

// function to trim urls
function removeQueryParams(arr) {
    return arr.map(obj => {
        if (!obj.url) {
            return obj; // Return the original object if there's no URL
        }

        try {
            const url = new URL(obj.url);
            console.log(url.search);
            url.search = '';
            console.log(url.search);
            console.log(url.toString());
            return {
                ...obj,
                url: url.toString(),
            };
        } catch (error) {
            console.error(`Invalid URL: ${obj.url}`);
            return obj; // Return the original object if URL is invalid
        }
    });
}

// function to remove duplicate tools
function removeDuplicates(arr) {
    // Create a new Map to store unique urls and their objects
    const uniqueMap = new Map();
    console.log(uniqueMap);

    // Iterate through the input array
    for (const obj of arr) {
        // If the url is not in the Map, add it to the map. This gets rid of duplicate urls
        if (!uniqueMap.has(obj.url)) {
            uniqueMap.set(obj.url, obj);
        }
    }

    // Convert the Map values back to an array
    return Array.from(uniqueMap.values());
}

