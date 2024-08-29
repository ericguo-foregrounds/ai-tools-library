# ai-tools-library

The scripts found in this repository create a final output in a JSON file with AI tool data for an AI tools library, including

- **Tool Name**
- **Tool URL**
- **Tool Description**
- **Use Cases**
- **Key Features**
- **Functional Area**
- **Pricing Model**

## Instructions

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/ericguo-foregrounds/ai-tools-library.git
   cd ai-tools-library
   ```

2. **Install Dependencies:**
    - Make sure you have Node.js and npm installed first
   ```bash
   npm install
   ```

3. **Create and Configure the `.env` File:**

   ```bash
   cp .env.example .env
   ```

   - Open the `.env` file and add your actual API key.

4. **Prepare Your Data:**

   - The `scraper.js` script currently scrapes from Insidr.ai
   - If you are scraping from a different site, make sure reconfigure the `scraper.js` file.

5. **Run the Script:**
    - **The scripts follows a very specific order**
   ```bash
   node scraper.js
   ```
   then
   ```bash
   node evaluator.js
   ```
   then
   ```bash
   node getSpecificLinks.js
   ```
   then
   ```bash
   node getUseCases.js
   ```
   then
   ```bash
   node getKeyFeatures.js
   ```
   then
   ```bash
   node pruneData.js
   ```
   then
   ```bash
   node getPricing.js
   ```
   then
   ```bash
   nodegetFuncArea.js
   ```
   and finally
   ```bash
   node cleanUpData.js
   ```
6. **Access Data**
    - Go into the data subdirectory.
    - The final data will be in the file `finalData.json`.
