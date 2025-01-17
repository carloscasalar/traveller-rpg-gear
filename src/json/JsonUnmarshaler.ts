import { describe } from 'vitest';
import { ErrorAware } from '../types/returnTypes';

export interface JsonUnmarshaler<T> {
    unmarshal(data: string): ErrorAware<T>;
    serializeSchema(): string;
}
