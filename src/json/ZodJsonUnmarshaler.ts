import { z } from 'zod';

import { ErrorAware } from '../types/returnTypes';
import { JsonUnmarshaler } from './JsonUnmarshaler';

export class ZodJsonUnmarshaler<T> implements JsonUnmarshaler<T> {
    constructor(
        private readonly schema: z.ZodType<T>,
        private readonly serializedSchema: string,
    ) {}
    unmarshal(data: string): ErrorAware<T> {
        let parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch (e) {
            return { error: `unable to parse literal string to JSON, string: ${data}: ${e}` };
        }

        const unmarshalingResult = this.schema.safeParse(parsedData);
        if (unmarshalingResult.error) {
            return { error: `JSON object doesn't meet expected format: ${unmarshalingResult.error.issues}` };
        }

        return unmarshalingResult.data;
    }

    serializeSchema(): string {
        return this.serializedSchema;
    }
}
