/**
 * Loads the Google Maps JS SDK with the Places library, once. Returns a
 * shared promise so concurrent callers reuse the same script tag. Resolves
 * immediately if the SDK is already present.
 */
let loadPromise: Promise<void> | null = null;

/** Browser key for Maps (optional): without it, address and route features degrade to plain text. */
export const GOOGLE_MAPS_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // allow a retry on a later mount
      reject(new Error('No se pudo cargar Google Maps'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
