import { apiRequest } from "../api/client";
import { createSharedResource } from "../api/sharedResource";
import { DEFAULT_DIRECTORY_SETTINGS, toDirectorySettings } from "../utils/directorySettings";

// The admin's Directory settings (Directory_API/getPublic), read-only, the
// same source the web app's sidebar Directory reads. One shared copy for
// every screen (see sharedResource.js).
const settingsResource = createSharedResource(async () => {
  const data = await apiRequest("Directory_API/getPublic");
  return toDirectorySettings(data.settings);
});

// A failed read (or one still loading) shows everything, as on web: a blip
// in the network shouldn't empty the directory.
export function useDirectorySettings() {
  return settingsResource.useResource().data || DEFAULT_DIRECTORY_SETTINGS;
}
