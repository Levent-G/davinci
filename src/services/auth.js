// src/services/auth.js
// Google/Apple ile giriş — Firebase Authentication üzerinden.
//
// KURULUM (koddan bağımsız, mağazaya göndermeden önce mutlaka yapılmalı):
// 1) Firebase Console > Authentication > Sign-in method'da "Google" ve
//    "Apple" sağlayıcılarını etkinleştirin.
// 2) Google'ı etkinleştirdikten sonra Project Settings > Genel sekmesinden
//    hem Android hem iOS uygulaması için google-services.json /
//    GoogleService-Info.plist dosyalarını YENİDEN indirip projenin köküne
//    koyun (yeni OAuth client ID'leri bu dosyalara otomatik eklenir).
// 3) GoogleService-Info.plist içindeki REVERSED_CLIENT_ID değerini alıp
//    app.json > plugins > "@react-native-google-signin/google-signin" >
//    iosUrlScheme alanına yapıştırın.
// 4) google-services.json içinde "client_type": 3 olan oauth_client'ın
//    "client_id" değerini aşağıdaki WEB_CLIENT_ID'ye yapıştırın (bu web
//    client ID Android'de ve iOS'ta ortak/gerekli).
// 5) Apple girişi için: Apple Developer hesabında bu App ID'ye
//    (com.davinci.words) "Sign In with Apple" capability'sini ekleyin,
//    sonra Firebase Console'da Apple sağlayıcısını etkinleştirirken
//    istenen Services ID / Team ID / Key ID / private key bilgilerini
//    Apple Developer > Certificates, Identifiers & Profiles'tan oluşturup
//    girin.
import { Platform } from "react-native";
import auth from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { ensureFirebaseReady } from "./firebase";

const WEB_CLIENT_ID =
  "502687781194-bva2als1k13871ep73ovbf94j7rim8ai.apps.googleusercontent.com";

// Admin paneline erişebilecek email adresleri — küçük/büyük harf duyarsız.
export const ADMIN_EMAILS = [
  "levent_gulsum@outlook.com",
  "burakgs.gurpinar@hotmail.com",
];

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  googleConfigured = true;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
}

export async function isAppleSignInAvailable() {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithGoogle() {
  await ensureFirebaseReady();
  ensureGoogleConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  // @react-native-google-signin v13+ { type, data: { idToken } } döner,
  // eski sürümler doğrudan { idToken } döndürüyordu — ikisini de destekle.
  const idToken = result?.data?.idToken || result?.idToken;
  if (!idToken) {
    throw new Error("Google girişinden kimlik bilgisi (idToken) alınamadı.");
  }
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(credential);
  return userCredential.user;
}

export async function signInWithApple() {
  if (Platform.OS !== "ios") {
    throw new Error("Apple ile giriş sadece iOS'ta kullanılabilir.");
  }
  await ensureFirebaseReady();
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  const { identityToken } = appleCredential;
  if (!identityToken) {
    throw new Error("Apple girişinden kimlik bilgisi (identityToken) alınamadı.");
  }
  const credential = auth.AppleAuthProvider.credential(identityToken);
  const userCredential = await auth().signInWithCredential(credential);

  // Apple, ad-soyadı SADECE kullanıcının bu uygulamaya ilk izin verişinde
  // gönderir — bir daha asla gelmez. Firebase Auth profiline kalıcı olarak
  // yazmazsak bir sonraki girişte isim tamamen kaybolur.
  const { givenName, familyName } = appleCredential.fullName || {};
  const fullName = [givenName, familyName].filter(Boolean).join(" ");
  if (fullName && !userCredential.user.displayName) {
    try {
      await userCredential.user.updateProfile({ displayName: fullName });
    } catch {}
  }
  return auth().currentUser || userCredential.user;
}

// Apple'ın App Store kuralı 5.1.1(v): hesap oluşturmayı destekleyen bir
// uygulama, hesabı uygulama İÇİNDEN silmeyi de desteklemek zorunda.
// Firebase, güvenlik gereği "yakın zamanda giriş yapılmamışsa" silmeyi
// reddedebilir (auth/requires-recent-login) — bu durumda çağıran taraf
// kullanıcıya çıkış yapıp tekrar giriş yapmasını söylemeli.
export async function deleteAuthAccount() {
  const user = auth().currentUser;
  if (!user) return;
  await user.delete();
}

export async function signOutUser() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google ile girilmemiş olabilir, yok sayılır.
  }
  await auth().signOut();
}

export function onAuthStateChanged(callback) {
  return auth().onAuthStateChanged(callback);
}

export function getCurrentAuthUser() {
  return auth().currentUser;
}
