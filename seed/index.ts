import { parse } from 'csv-parse';
import * as fs from 'fs';
import { Readable } from 'stream';

const CSV_URL = 'https://raw.githubusercontent.com/Grauenwolf/TravellerTools/9d2a33b990796e5afb7821d87ef6258b688956f5/TravellerTools/Grauenwolf.TravellerTools.Web/wwwroot/App_Data/Equipment.csv';

async function generateSeedScript() {
  try {
    // Create write stream for migrate.sh
    const outputFile = fs.createWriteStream('seed.sh');

    // Write initial TRUNCATE command
    outputFile.write('npx wrangler d1 execute traveller-equipment --remote --command "TRUNCATE TABLE equipment"\n');

    // Download and process CSV
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Create readable stream from response
    const csvStream = Readable.from(response.body!);

    // Set up CSV parser
    const parser = parse({
      columns: true,
      skip_empty_lines: true
    });

    // Process records as they come in
    parser.on('data', (row: any) => {
      const values = Object.values(row)
        .map(val => `'${(val || '').toString().replace(/'/g, "''")}'`)
        .join(', ');

      const sqlCommand =
        `npx wrangler d1 execute traveller-equipment --remote --command "INSERT INTO equipment ` +
        `(Section, Subsection, Name, TL, Mass, Price, AmmoPrice, Species, Skill, Book, Page, Contraband, Category, Law, Notes, Mod) ` +
        `VALUES (${values})"\n`;

      outputFile.write(sqlCommand);
    });

    // Pipe CSV data through parser
    csvStream.pipe(parser);

    // Wait for completion
    await new Promise((resolve, reject) => {
      parser.on('end', resolve);
      parser.on('error', reject);
    });

    outputFile.end();
    console.log('Migration script generated successfully');

  } catch (error) {
    console.error('Error:', error);
  }
}

generateSeedScript();
