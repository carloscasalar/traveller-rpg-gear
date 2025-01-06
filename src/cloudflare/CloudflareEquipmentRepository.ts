import { Context } from 'hono';
import { Env } from '../env';
import { EquipmentRepository } from '../EquipmentRepository';

export class CloudflareEquipmentRepository implements EquipmentRepository {
    constructor(private readonly context: Context<{ Bindings: Env }>) {}

}
