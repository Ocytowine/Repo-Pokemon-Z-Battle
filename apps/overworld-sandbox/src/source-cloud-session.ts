import { Capacitor } from "@capacitor/core";
import * as InAppBrowserModule from "@capacitor/inappbrowser";
import { connectMobileAccount, mobileIdentity } from "./source-mobile-account.js";

const { InAppBrowser } = InAppBrowserModule;
type BrowserOptions = Parameters<typeof InAppBrowser.openInWebView>[0]["options"];
// The package publishes this runtime export, but its .d.ts omits the .js extension
// on the re-export, which TypeScript's NodeNext resolver cannot follow.
const DefaultWebViewOptions = (InAppBrowserModule as unknown as
  { readonly DefaultWebViewOptions: BrowserOptions }).DefaultWebViewOptions;

const CLOUD_LOGIN_URL = "https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev/api/login";

export async function checkSourceCloudSession(): Promise<string> {
  if (Capacitor.getPlatform() !== "android") return "Essai de connexion disponible dans l'APK Android.";
  try {
    const email = await mobileIdentity();
    if (email !== null) return `Connecté au cloud : ${email}`;
    return "Connexion non reconnue dans l'app. Réessayez avec le bouton Connexion.";
  } catch {
    return "Cloud inaccessible actuellement. La partie locale reste disponible.";
  }
}

/** Access verifies the email once; a revocable encrypted device session persists afterward. */
export async function openSourceCloudLogin(onResult: (status: string) => void): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    onResult("Essai de connexion disponible dans l'APK Android.");
    return;
  }
  try {
    const email = await mobileIdentity();
    if (email !== null) {
      onResult(`Connecté au cloud : ${email}`);
      return;
    }
  } catch {
    // A network error must not open a new Access login over a valid local session.
    onResult("Cloud inaccessible actuellement. La partie locale reste disponible.");
    return;
  }
  let listener: Awaited<ReturnType<typeof InAppBrowser.addListener>> | null = null;
  try {
    listener = await InAppBrowser.addListener("browserClosed", () => {
      void listener?.remove();
      void connectMobileAccount().then(() => checkSourceCloudSession()).then(onResult)
        .catch(() => onResult("Connexion impossible actuellement. Réessaie plus tard."));
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
