import { Capacitor, CapacitorHttp } from "@capacitor/core";
import * as InAppBrowserModule from "@capacitor/inappbrowser";

const { InAppBrowser } = InAppBrowserModule;
type BrowserOptions = Parameters<typeof InAppBrowser.openInWebView>[0]["options"];
// The package publishes this runtime export, but its .d.ts omits the .js extension
// on the re-export, which TypeScript's NodeNext resolver cannot follow.
const DefaultWebViewOptions = (InAppBrowserModule as unknown as
  { readonly DefaultWebViewOptions: BrowserOptions }).DefaultWebViewOptions;

const CLOUD_SESSION_URL = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev/api/session";
const CLOUD_LOGIN_URL = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev/api/login";

export async function checkSourceCloudSession(): Promise<string> {
  if (Capacitor.getPlatform() !== "android") return "Essai de connexion disponible dans l'APK Android.";
  try {
    const response = await CapacitorHttp.get({ url: CLOUD_SESSION_URL, connectTimeout: 10_000,
      readTimeout: 10_000 });
    const data: unknown = response.data;
    if (response.status === 200 && typeof data === "object" && data !== null
      && "authenticated" in data && data.authenticated === true
      && "email" in data && typeof data.email === "string") {
      return `Connecté au cloud : ${data.email}`;
    }
    return "Connexion non reconnue dans l'app. Réessayez avec le bouton Connexion.";
  } catch {
    return "Cloud inaccessible actuellement. La partie locale reste disponible.";
  }
}

/** Uses the Android WebView cookie jar; a system browser has a different session. */
export async function openSourceCloudLogin(onResult: (status: string) => void): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    onResult("Essai de connexion disponible dans l'APK Android.");
    return;
  }
  let listener: Awaited<ReturnType<typeof InAppBrowser.addListener>> | null = null;
  try {
    listener = await InAppBrowser.addListener("browserClosed", () => {
      void listener?.remove();
      void checkSourceCloudSession().then(onResult);
    });
    await InAppBrowser.openInWebView({ url: CLOUD_LOGIN_URL,
      options: { ...DefaultWebViewOptions, showToolbar: true, showURL: false,
        clearCache: false, clearSessionCache: false,
        android: { ...DefaultWebViewOptions.android, isIsolated: false } } });
  } catch {
    await listener?.remove();
    onResult("Impossible d'ouvrir la connexion cloud. La partie locale reste disponible.");
  }
}
