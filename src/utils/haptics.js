// src/utils/haptics.js
// Kullanıcının Profil > Titreşim ayarına bağlı, tek noktadan yönetilen
// haptic feedback yardımcıları. Ayar kapalıysa hiçbir şey yapmaz.
import * as Haptics from "expo-haptics";
import { Storage } from "./storage";

async function isHapticEnabled() {
  try {
    const settings = await Storage.getSettings();
    return settings?.hapticEnabled !== false;
  } catch {
    return true;
  }
}

export async function hapticLight() {
  if (!(await isHapticEnabled())) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export async function hapticSuccess() {
  if (!(await isHapticEnabled())) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {}
  );
}

export async function hapticError() {
  if (!(await isHapticEnabled())) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => {}
  );
}
