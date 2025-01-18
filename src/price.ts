import { Equipment } from './EquipmentRepository';

/** Convert the provided price to the format Cr<Integer with thousands comma separator> */
export const toCrFormat = (price: number): string => {
    return `Cr${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true })}`;
};

export const creditsFromCrFormat = (price?: string): number => {
    if (!price) {
        return 0;
    }
    return parseInt(price.replace('Cr', '').replace(',', ''));
};

export const getTotalCost = (items: Equipment[]): number => {
    return items.reduce((acc, item) => acc + creditsFromCrFormat(item.price), 0);
};
