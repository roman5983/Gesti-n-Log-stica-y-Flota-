/**
 * Open a fetched blob in a new tab. An <a target="_blank"> click works even
 * after an await, whereas window.open() loses the user gesture and is
 * blocked as a popup. The object URL is revoked after a delay so the new
 * tab has time to load it.
 */
export function openBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
