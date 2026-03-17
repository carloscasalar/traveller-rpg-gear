import { parse } from 'csv-parse';
import * as fs from 'fs';
import { Readable } from 'stream';

import { NEEDS, type Need } from '../src/needs.ts';

const CSV_URL =
    'https://raw.githubusercontent.com/Grauenwolf/TravellerTools/9d2a33b990796e5afb7821d87ef6258b688956f5/TravellerTools/Grauenwolf.TravellerTools.Web/wwwroot/App_Data/Equipment.csv';

interface EquipmentNeed {
    need: Need;
    weight: number;
}

// Helper to parse price strings (Cr500, Cr1,200,000, MCr1.2) to integer credits
function parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    const str = priceStr.trim().toUpperCase();
    if (str.startsWith('MCR')) {
        const val = parseFloat(str.substring(3).replace(/,/g, ''));
        return Math.round(val * 1_000_000);
    }
    if (str.startsWith('CR')) {
        return parseInt(str.substring(2).replace(/,/g, ''), 10) || 0;
    }
    return 0;
}

// Derive needs tags from equipment fields
function deriveNeeds(row: any): EquipmentNeed[] {
    const section = (row.Section || '').toLowerCase();
    const subsection = (row.Subsection || '').toLowerCase();
    const category = (row.Category || '').toLowerCase();
    const name = (row.Name || '').toLowerCase();
    const notes = (row.Notes || '').toLowerCase();

    const needs: EquipmentNeed[] = [];

    // Weapons
    if (section.includes('weapon') || category === 'weapon') {
        if (name.includes('rifle') || name.includes('carbine') || name.includes('pistol') || name.includes('gun')) {
            needs.push({ need: 'combat_ranged', weight: 9 });
        } else if (name.includes('blade') || name.includes('sword') || name.includes('axe') || name.includes('club')) {
            needs.push({ need: 'combat_melee', weight: 9 });
        } else {
            needs.push({ need: 'combat_ranged', weight: 8 });
            needs.push({ need: 'combat_melee', weight: 6 });
        }
    }

    // Armour
    if (section.includes('armour')) {
        needs.push({ need: 'protection', weight: 10 });
    }

    // Medical
    if (section.includes('medical') || name.includes('medkit') || name.includes('medical')) {
        needs.push({ need: 'medical', weight: 10 });
    }

    // Survival Gear
    if (section.includes('survival') || subsection.includes('survival')) {
        needs.push({ need: 'survival', weight: 9 });
    }

    // Electronics & Sensors
    if (section.includes('electronics') || name.includes('sensor') || name.includes('scanner')) {
        needs.push({ need: 'sensors', weight: 8 });
        needs.push({ need: 'communications', weight: 6 });
    }

    // Computers
    if (section.includes('computer') || name.includes('computer')) {
        needs.push({ need: 'computing', weight: 9 });
        if (name.includes('intrusion') || notes.includes('hack')) {
            needs.push({ need: 'hacking', weight: 8 });
        }
    }

    // Tools
    if (section.includes('tools') || subsection.includes('tools')) {
        needs.push({ need: 'engineering', weight: 8 });
        if (name.includes('science') || name.includes('lab')) {
            needs.push({ need: 'science', weight: 8 });
        }
    }

    // Stealth & infiltration
    if (name.includes('stealth') || name.includes('camouflage') || name.includes('disguise')) {
        needs.push({ need: 'stealth', weight: 9 });
    }

    // Mobility (vehicles, grav belts, etc)
    if (name.includes('grav') || name.includes('vehicle') || name.includes('thruster')) {
        needs.push({ need: 'mobility', weight: 8 });
    }

    // Communications
    if (name.includes('communicator') || name.includes('comms') || name.includes('radio')) {
        needs.push({ need: 'communications', weight: 9 });
    }

    // Social items (clothing, luxury goods)
    if (section.includes('comfort') || name.includes('formal') || name.includes('luxury')) {
        needs.push({ need: 'social', weight: 7 });
    }

    // Cargo & containers
    if (name.includes('container') || name.includes('cargo') || name.includes('crate')) {
        needs.push({ need: 'cargo', weight: 8 });
    }

    return needs;
}

async function generateSchemaScript() {
    try {
        const outputFile = fs.createWriteStream('schema.sql');

        // Drop tables
        outputFile.write('DROP TABLE IF EXISTS equipment_needs;\n');
        outputFile.write('DROP TABLE IF EXISTS equipment;\n\n');

        // Create equipment table with normalized fields
        outputFile.write(`CREATE TABLE IF NOT EXISTS equipment (
			id VARCHAR(36) PRIMARY KEY,
			section VARCHAR(255),
			subsection VARCHAR(255),
			name VARCHAR(255),
			tl INT,
			weight_kg REAL,
			price_cr INT,
			ammo_price VARCHAR(100),
			species VARCHAR(255),
			skill VARCHAR(100),
			book VARCHAR(100),
			page INT,
			contraband INT,
			category VARCHAR(100),
			law_illegal_from INT,
			notes TEXT,
			mod VARCHAR(100)
		);\n\n`);

        // Create equipment_needs join table
        outputFile.write(`CREATE TABLE IF NOT EXISTS equipment_needs (
			equipment_id VARCHAR(36),
			need VARCHAR(50),
			weight INT CHECK(weight >= 0 AND weight <= 10),
			FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
			PRIMARY KEY (equipment_id, need)
		);\n\n`);

        // Create indexes
        outputFile.write('CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);\n');
        outputFile.write('CREATE INDEX IF NOT EXISTS idx_equipment_tl ON equipment(tl);\n');
        outputFile.write('CREATE INDEX IF NOT EXISTS idx_equipment_price_cr ON equipment(price_cr);\n');
        outputFile.write('CREATE INDEX IF NOT EXISTS idx_equipment_weight_kg ON equipment(weight_kg);\n');
        outputFile.write('CREATE INDEX IF NOT EXISTS idx_equipment_law ON equipment(law_illegal_from);\n');
        outputFile.write('CREATE INDEX IF NOT EXISTS idx_equipment_composite ON equipment(category, tl, price_cr);\n');
        outputFile.write('CREATE INDEX IF NOT EXISTS idx_equipment_needs_need ON equipment_needs(need);\n\n');

        // Storage for equipment_needs insertions
        const needsInserts: string[] = [];

        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const csvStream = Readable.from(response.body!);
        const parser = parse({
            columns: true,
            skip_empty_lines: true,
        });

        parser.on('data', (row: any) => {
            const uuid = crypto.randomUUID();

            // Parse normalized fields
            const priceCr = parsePrice(row.Price || '');
            const weightKg = row.Mass ? parseFloat(row.Mass) || 0 : 0;
            const lawIllegalFrom = row.Law && parseInt(row.Law) > 0 ? parseInt(row.Law) : null;

            // Parse other fields
            const section = (row.Section || '').replace(/'/g, "''");
            const subsection = (row.Subsection || '').replace(/'/g, "''");
            const name = (row.Name || '').replace(/'/g, "''");
            const tl = row.TL ? parseInt(row.TL) || 0 : 0;
            const ammoPrice = (row['Ammo Price'] || '').replace(/'/g, "''");
            const species = (row.Species || '').replace(/'/g, "''");
            const skill = (row.Skill || '').replace(/'/g, "''");
            const book = (row.Book || '').replace(/'/g, "''");
            const page = row.Page ? parseInt(row.Page) || 0 : 0;
            const contraband = row.Contraband ? parseInt(row.Contraband) || 0 : 0;
            const category = (row.Category || '').replace(/'/g, "''");
            const notes = (row.Notes || '').replace(/'/g, "''");
            const mod = (row.Mod || '').replace(/'/g, "''");

            // Insert equipment
            const sqlCommand = `INSERT INTO equipment (id, section, subsection, name, tl, weight_kg, price_cr, ammo_price, species, skill, book, page, contraband, category, law_illegal_from, notes, mod) VALUES ('${uuid}', '${section}', '${subsection}', '${name}', ${tl}, ${weightKg}, ${priceCr}, '${ammoPrice}', '${species}', '${skill}', '${book}', ${page}, ${contraband}, '${category}', ${lawIllegalFrom === null ? 'NULL' : lawIllegalFrom}, '${notes}', '${mod}');\n`;
            outputFile.write(sqlCommand);

            // Derive and store needs
            const needs = deriveNeeds(row);
            for (const need of needs) {
                needsInserts.push(
                    `INSERT INTO equipment_needs (equipment_id, need, weight) VALUES ('${uuid}', '${need.need}', ${need.weight});\n`,
                );
            }
        });

        csvStream.pipe(parser);

        await new Promise((resolve, reject) => {
            parser.on('end', resolve);
            parser.on('error', reject);
        });

        // Write all needs insertions
        outputFile.write('\n-- Equipment needs\n');
        for (const insert of needsInserts) {
            outputFile.write(insert);
        }

        outputFile.end();
        console.log('Schema script generated successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}

generateSchemaScript();
