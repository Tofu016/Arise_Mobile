import { apiRequest } from "../api/client";
import { createSharedResource } from "../api/sharedResource";

// The placard scanner's settings that aren't per room
// (PlacardDialogs_API/getOcrSettings), set on the web's OCR Management page:
// scannerMessage, shown at the top of the placard scanner ("" for none). One
// shared copy for every screen (see sharedResource.js).
const settingsResource = createSharedResource(async () => {
  const data = await apiRequest("PlacardDialogs_API/getOcrSettings");
  return { scannerMessage: (data.settings?.scanner_message || "").trim() };
});

const NO_SETTINGS = { scannerMessage: "" };

// A failed read (or an API from before this endpoint) is no message, not an
// error worth showing over the camera.
export function useOcrSettings() {
  return settingsResource.useResource().data || NO_SETTINGS;
}
