import { createShareLink } from './share-link.js';

// Each tab owns its URL. Never use shared browser storage.
export function createAddressWriter({ getURL, replaceURL, onStatus = () => {}, encode = createShareLink }) {
  let revision = 0, pending = false, failed = false;
  return {
    get unsettled() { return pending || failed; },
    cancel() { revision++; pending = false; failed = false; },
    async save(composition) {
      const ticket = ++revision;
      const originalURL = getURL();
      pending = true; failed = false; onStatus('Saving in address…');
      try {
        const link = await encode(composition, originalURL);
        if (ticket !== revision || getURL() !== originalURL) return;
        const url = new URL(originalURL);
        url.hash = new URL(link).hash;
        replaceURL(url.href);
        pending = false;
        onStatus('Saved in this tab’s address');
      } catch (error) {
        if (ticket !== revision || getURL() !== originalURL) return;
        pending = false; failed = true;
        onStatus('Address not saved — ' + error.message);
      }
    },
  };
}
