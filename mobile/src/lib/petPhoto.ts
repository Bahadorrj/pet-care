import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

/**
 * Launch the image gallery and return the picked asset URI,
 * or null if the user cancels.
 */
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Copy a picked file into the app's document directory under a UUID-based
 * filename (preserving the source extension). Returns the persistent stored path.
 */
export async function savePhoto(uri: string): Promise<string> {
  const ext = uri.split('.').pop() ?? 'jpg';
  const filename = `${Crypto.randomUUID()}.${ext}`;

  const src = new File(uri);
  const dest = new File(Paths.document, filename);

  await src.copy(dest);

  return dest.uri;
}

/**
 * Delete a stored photo. No-op if path is null/empty or the file is missing.
 */
export async function deletePhoto(path: string | null): Promise<void> {
  if (!path) return;

  const file = new File(path);
  if (file.exists) {
    file.delete();
  }
}
