import { z } from 'zod';
import { printNode, zodToTs } from 'zod-to-ts';
import { JsonUnmarshaler } from './JsonUnmarshaler';
import { ErrorAware } from '../types/returnTypes';

export class ZodJsonUnmarshaler<T> implements JsonUnmarshaler<T> {
    constructor(private readonly schema: z.ZodType<T>) {}
    unmarshal(data: string): ErrorAware<T> {
        let parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch (e) {
            return { error: `unable to parse literal string to JSON, string: ${data}: ${e}` };
        }

        const unmarshalingResult = this.schema.safeParse(parsedData);
        if (unmarshalingResult.error) {
            return { error: `JSON object doesn't meet expected format: ${unmarshalingResult.error.errors}` };
        }

        return unmarshalingResult.data;
    }

    serializeSchema(): string {
        const { node } = zodToTs(this.schema, 'type');
        return printNode(node);
    }
}
