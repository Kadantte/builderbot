export const parseMetaNumber = (number: string): string => {
    if (typeof number !== 'string') {
        return number;
    }
    number = number.replace(/\+/g, '').replace(/\s/g, '');
    return number;
}
