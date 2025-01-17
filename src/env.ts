import { Ai, D1Database, VectorizeIndex } from '@cloudflare/workers-types';

export interface Env {
    DB: D1Database;
    VECTORIZE: VectorizeIndex;
    AI: Ai;
}
