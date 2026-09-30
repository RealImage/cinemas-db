/** Screen and device addresses are IPv4 only (the API refuses anything else). */
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

export const isIPv4 = (value: string) => IPV4.test(value.trim());
