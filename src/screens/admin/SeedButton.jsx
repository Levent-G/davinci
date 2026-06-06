// AdminWordsScreen.jsx içine ekle
// 1) Import'lara ekle:
import { ALL_WORDS } from '../../data/wordDatabase';
import firestore from '@react-native-firebase/firestore';

// 2) State'e ekle:
const [seeding, setSeeding] = useState(false);
const [seedProgress, setSeedProgress] = useState(0);

// 3) Fonksiyonu ekle:
const handleSeedFirebase = async () => {
  Alert.alert(
    'Firebase Seed',
    `${ALL_WORDS.length} kelime Firebase\'e yüklenecek. Devam?`,
    [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Yükle',
        onPress: async () => {
          setSeeding(true);
          setSeedProgress(0);
          try {
            const BATCH_SIZE = 490;
            const total = ALL_WORDS.length;
            let uploaded = 0;

            for (let i = 0; i < total; i += BATCH_SIZE) {
              const batch = firestore().batch();
              const chunk = ALL_WORDS.slice(i, i + BATCH_SIZE);

              chunk.forEach((word) => {
                const ref = firestore().collection('words').doc(word.id);
                batch.set(ref, {
                  ...word,
                  createdAt: firestore.FieldValue.serverTimestamp(),
                  masteryLevel: 0,
                  timesShown: 0,
                  timesCorrect: 0,
                });
              });

              await batch.commit();
              uploaded += chunk.length;
              setSeedProgress(Math.round((uploaded / total) * 100));
            }

            Alert.alert('✅ Başarılı!', `${total} kelime Firebase\'e yüklendi!`);
          } catch (err) {
            Alert.alert('❌ Hata', err.message);
          } finally {
            setSeeding(false);
            setSeedProgress(0);
          }
        },
      },
    ]
  );
};

// 4) JSX'e ekle (mevcut butonların yanına):
{seeding ? (
  <View style={{ padding: 20, alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#6C63FF" />
    <Text style={{ marginTop: 8, color: '#666' }}>
      Yükleniyor... %{seedProgress}
    </Text>
  </View>
) : (
  <TouchableOpacity
    style={{
      backgroundColor: '#FF6B35',
      padding: 14,
      borderRadius: 10,
      margin: 16,
      alignItems: 'center',
    }}
    onPress={handleSeedFirebase}
  >
    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
      🔥 Firebase'e Seed Et ({ALL_WORDS.length} kelime)
    </Text>
  </TouchableOpacity>
)}