import { parse } from 'csv-parse';
import * as fs from 'fs';
import { finished } from 'stream/promises';

const CSV_URL = 'https://raw.githubusercontent.com/Grauenwolf/TravellerTools/9d2a33b990796e5afb7821d87ef6258b688956f5/TravellerTools/Grauenwolf.TravellerTools.Web/wwwroot/App_Data/Equipment.csv';

async function downloadAndProcessCSV() {
	try {
		// Download CSV
		const response = await fetch(CSV_URL);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const csvData = await response.text();
		const records: string[][] = [];

		// Parse CSV
		const parser = parse(csvData);
		parser.on('readable', () => {
			let record;
			while ((record = parser.read()) !== null) {
				records.push(record);
			}
		});

		await finished(parser);

		// Generate migration file
		const headers = records[0];
		const data = records.slice(1);

		let migrationContent = 'npx wrangler d1 execute traveller-equipment --remote --command "TRUNCATE TABLE equipment"\n';

		data.forEach(row => {
			const values = row.map(value => `'${value.replace(/'/g, "''")}'`).join(', ');
			const insertStatement = `npx wrangler d1 execute traveller-equipment --remote --command "INSERT INTO equipment (${headers.join(', ')}) VALUES (${values})"\n`;
			migrationContent += insertStatement;
		});

		// Write to migrate.sh
		fs.writeFileSync('migrate.sh', migrationContent);
		console.log('Migration file generated successfully!');

	} catch (error) {
		console.error('Error:', error);
	}
}

downloadAndProcessCSV();
