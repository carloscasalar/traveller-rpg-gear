import { Equipment } from './EquipmentRepository';

/** Convert the provided price to the format Cr<Integer with thousands comma separator> */
export const toCrFormat = (price: number): string => {
    return `Cr${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true })}`;
};

export const getTotalCost = (items: Equipment[]): number => {
    return items.reduce((acc, item) => acc + item.price_cr, 0);
};
