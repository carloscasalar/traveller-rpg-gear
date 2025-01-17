import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ZodJsonUnmarshaler } from './ZodJsonUnmarshaler';

describe('ZodJsonUnmarshaler', () => {
    const schema = z.object({
        name: z.string(),
        age: z.number(),
    });

    const unmarshaler = new ZodJsonUnmarshaler(schema);

    it('should unmarshal valid JSON string successfully', () => {
        const jsonString = JSON.stringify({ name: 'John', age: 30 });
        const result = unmarshaler.unmarshal(jsonString);
        expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should return error for invalid JSON string', () => {
        const invalidJsonString = '{"name": "John", "age": 30';
        const result = unmarshaler.unmarshal(invalidJsonString);
        expect(result).toEqual({ error: expect.stringContaining('unable to parse literal string to JSON') });
    });

    it('should return error for JSON not matching schema', () => {
        const invalidJsonString = JSON.stringify({ name: 'John', age: 'thirty' });
        const result = unmarshaler.unmarshal(invalidJsonString);
        expect(result).toEqual({ error: expect.stringContaining("JSON object doesn't meet expected format") });
    });
});
