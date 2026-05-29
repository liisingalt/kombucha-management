export const BASE_PATH: string = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const mobileBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export const API_BASE: string = mobileBase ?? BASE_PATH;
