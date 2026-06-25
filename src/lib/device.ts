/**
 * TV/smart-device browser detection utilities.
 */

const TV_PATTERNS = [
  /SmartTV/i,
  /Smart_TV/i,
  /Tizen/i,
  /WebOs/i,
  /Web0S/i,
  /webOS/i,
  /WebOS/i,
  /Hisense/i,
  /VIDAA/i,
  /Viera/i,
  /NetCast/i,
  /Roku\/DVP/i,
  /AppleTV/i,
  /CrKey/i,        // Chromecast
  /Android TV/i,
  /GoogleTV/i,
  /AFTS/i,         // Amazon Fire TV
  /BRAVIA/i,
  /SonyCEBrowser/i,
  /PhilipsTv/i,
  /Opera TV/i,
  /Vewd/i,
  /HbbTV/i,
  /playstation/i,
  /nintendo/i,
  /xbox/i,
  /SMART-TV/i,
];

/** Detect if the current browser is running on a Smart TV or similar device */
export function isTvBrowser(userAgent?: string | null): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!ua) return false;
  return TV_PATTERNS.some((pattern) => pattern.test(ua));
}

/** Detect if we're on a mobile device */
export function isMobile(userAgent?: string | null): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!ua) return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
}

/** Get the best initial route for this device */
export function getDeviceRoute(userAgent?: string | null): string {
  if (isTvBrowser(userAgent)) return "/tv";
  if (isMobile(userAgent)) return "/lite";
  return "/dashboard";
}
