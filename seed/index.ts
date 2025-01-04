import { parse } from 'csv-parse';
import * as fs from 'fs';
import { Readable } from 'stream';

const CSV_URL = 'https://raw.githubusercontent.com/Grauenwolf/TravellerTools/9d2a33b990796e5afb7821d87ef6258b688956f5/TravellerTools/Grauenwolf.TravellerTools.Web/wwwroot/App_Data/Equipment.csv';

async function generateSchemaScript() {
  try {
    const outputFile = fs.createWriteStream('schema.sql');

    outputFile.write('DROP TABLE IF EXISTS equipment;\n\n');
    outputFile.write(`CREATE TABLE IF NOT EXISTS equipment (
      Section TEXT,
      Subsection TEXT,
      Name TEXT,
      TL INT,
      Mass INT,
      Price TEXT,
      AmmoPrice TEXT,
      Species TEXT,
      Skill TEXT,
      Book TEXT,
      Page INT,
      Contraband INT,
      Category TEXT,
      Law INT,
      Notes TEXT,
      Mod TEXT
    );\n\n`);

    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const csvStream = Readable.from(response.body!);
    const parser = parse({
      columns: true,
      skip_empty_lines: true
    });

    parser.on('data', (row: any) => {
      const values = Object.entries(row).map(([key, val]) => {
        // Ensure numeric fields are parsed as integers
        if (['TL', 'Mass', 'Page', 'Contraband', 'Law'].includes(key)) {
          return val ? parseInt(val.toString()) || 0 : 0;
        }
        // Keep text fields as they are but enclosed in single quotes
        return `'${(val || '').toString().replace(/'/g, "''")}'`;
      }).join(', ');

      const sqlCommand = `INSERT INTO equipment (Section, Subsection, Name, TL, Mass, Price, AmmoPrice, Species, Skill, Book, Page, Contraband, Category, Law, Notes, Mod) VALUES (${values});\n`;
      outputFile.write(sqlCommand);
    });

    csvStream.pipe(parser);

    await new Promise((resolve, reject) => {
      parser.on('end', resolve);
      parser.on('error', reject);
    });

    outputFile.end();
    console.log('Schema script generated successfully');

  } catch (error) {
    console.error('Error:', error);
  }
}

generateSchemaScript();
