export const parseGHLNumber = (number: string): string => {
    if (typeof number !== 'string') return number
    number = number.replace(/\+/g, '').replace(/\s/g, '').replace(/-/g, '')
    return number
}
