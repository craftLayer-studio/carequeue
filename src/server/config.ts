/** Public base URL used in QR codes and message links. */
export function appUrl(): string {
  const url = process.env.APP_URL ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export const PRODUCT_URL = "https://carequeue.craftlayer.store";
export const SUPPORT_EMAIL = "carequeue@craftlayer.store";
export const GENERAL_EMAIL = "hello@craftlayer.store";
export const LICENSING_EMAIL = "licensing@craftlayer.store";
export const COMPANY_URL = "https://craftlayer.store";
