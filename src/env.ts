import { D1Database, VectorizeIndex, Ai } from '@cloudflare/workers-types'
export interface Env {
    DB: D1Database;
    VECTORIZE: VectorizeIndex;
    AI: Ai;
}
