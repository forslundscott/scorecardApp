   function getOrdinalNumber(number) {
    // Convert the input to a number if it's a string
    const num = typeof number === 'string' ? parseInt(number, 10) : number;

    if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
        return 'Invalid input';
    }

    if (num === 0) {
        return '0th';
    }

    const lastDigit = num % 10;
    const secondLastDigit = Math.floor((num % 100) / 10);

    if (secondLastDigit === 1) {
        return num + 'th';
    }

    switch (lastDigit) {
        case 1:
            return num + 'st';
        case 2:
            return num + 'nd';
        case 3:
            return num + 'rd';
        default:
            return num + 'th';
    }
}