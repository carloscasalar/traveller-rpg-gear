/** Convert the provided price to the format Cr<Integer with thousands comma separator> */
export const toCrFormat = (price: number): string => {
    return `Cr${price.toLocaleString( 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true })}`;
};

export const creditsFromCrFormat = (price: string): number => {
    return parseInt(price.replace('Cr', '').replace(',', ''));
}
