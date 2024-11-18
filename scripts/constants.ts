export function hexConcat(items: string[]) {
    let result = "0x";
    items.forEach((item) => {
        result += item.substring(2);
    });
    return result;
}