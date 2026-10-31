import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeHost, parseXtreamM3uUrl } from '@/api/parsers';
import { createProvider } from '@/api/provider';
import type { Profile } from '@/api/types';
import { Button, IconButton } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { useLibraryStore } from '@/store/library';
import { useProfiles } from '@/store/profiles';
import { colors, radius, spacing, tvFocus } from '@/theme';

type Mode = 'xtream' | 'm3u';

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function LoginScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profiles, activeId, add, remove, setActive } = useProfiles();

  const [mode, setMode] = useState<Mode>('xtream');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = mode === 'xtream' ? !!host.trim() && !!username.trim() && !!password : !!m3uUrl.trim();

  const enter = (id: string) => {
    setActive(id);
    router.replace('/home');
  };

  const submit = async () => {
    setError(null);
    let profile: Profile;
    // Xtream "get.php" links carry credentials; using the Xtream API gives posters, EPG and series info.
    const fromM3u = mode === 'm3u' ? parseXtreamM3uUrl(m3uUrl) : null;
    if (mode === 'xtream' || fromM3u) {
      const creds = fromM3u ?? { host: normalizeHost(host), username: username.trim(), password };
      profile = {
        id: newId(),
        type: 'xtream',
        name: name.trim() || new URL(creds.host).hostname,
        ...creds,
        createdAt: Date.now(),
      };
    } else {
      const url = m3uUrl.trim();
      if (!/^https?:\/\//i.test(url)) {
        setError('The playlist URL must start with http:// or https://');
        return;
      }
      profile = { id: newId(), type: 'm3u', name: name.trim() || 'M3U Playlist', url, createdAt: Date.now() };
    }

    setLoading(true);
    try {
      const account = await createProvider(profile).authenticate();
      add(profile);
      queryClient.setQueryData([profile.id, 'account'], account);
      enter(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setLoading(false);
    }
  };

  const removeProfile = (profile: Profile) =>
    confirm('Delete playlist', `Remove "${profile.name}" and its favorites and history from this device?`, () => {
      remove(profile.id);
      useLibraryStore.getState().removeProfile(profile.id);
      queryClient.removeQueries({ queryKey: [profile.id] });
    });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {router.canGoBack() && (
              <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} style={styles.back} />
            )}
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="play" size={30} color="#fff" />
              </View>
              <Text style={styles.title}>Lumen Player</Text>
              <Text style={styles.subtitle}>Add your IPTV playlist to start watching</Text>
            </View>

            {profiles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your playlists</Text>
                {profiles.map((p) => (
                  <View key={p.id} style={[styles.profile, p.id === activeId && styles.profileActive]}>
                    <Pressable onPress={() => enter(p.id)} style={({ pressed, focused }) => [styles.profileMain, pressed && { opacity: 0.7 }, tvFocus(focused)]}>
                      <Ionicons name={p.type === 'xtream' ? 'server-outline' : 'list-outline'} size={22} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.profileMeta} numberOfLines={1}>
                          {p.type === 'xtream' ? `${p.username} · ${p.host}` : p.url}
                        </Text>
                      </View>
                    </Pressable>
                    <IconButton icon="trash-outline" size={18} color={colors.textMuted} label={`Delete ${p.name}`} onPress={() => removeProfile(p)} />
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{profiles.length ? 'Add another playlist' : 'Add playlist'}</Text>
              <View style={styles.segment}>
                <Segmented
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    setError(null);
                  }}
                  options={[
                    { value: 'xtream', label: 'Xtream Codes' },
                    { value: 'm3u', label: 'M3U URL' },
                  ]}
                />
              </View>

              <Field label="Playlist name (optional)" value={name} onChangeText={setName} placeholder="My IPTV" />
              {mode === 'xtream' ? (
                <>
                  <Field
                    label="Server URL"
                    value={host}
                    onChangeText={setHost}
                    placeholder="http://example.com:8080"
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Field
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                  />
                  <View>
                    <Field
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      onSubmitEditing={canSubmit ? submit : undefined}
                    />
                    <IconButton
                      icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      label={showPassword ? 'Hide password' : 'Show password'}
                      color={colors.textMuted}
                      size={20}
                      onPress={() => setShowPassword((v) => !v)}
                      style={styles.eye}
                    />
                  </View>
                </>
              ) : (
                <Field
                  label="Playlist URL"
                  value={m3uUrl}
                  onChangeText={setM3uUrl}
                  placeholder="http://example.com/get.php?username=…&type=m3u_plus"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={canSubmit ? submit : undefined}
                />
              )}

              {error && (
                <View style={styles.error}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button title="Connect" icon="log-in-outline" onPress={submit} loading={loading} disabled={!canSubmit} />
              <Text style={styles.disclaimer}>
                Lumen Player does not provide any content. Use it with playlists and subscriptions you are authorized to access.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 15, marginTop: spacing.xs, textAlign: 'center' },
  section: { marginBottom: spacing.xl, gap: spacing.md },
  sectionTitle: { color: colors.textDim, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  segment: { marginHorizontal: -spacing.lg },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileActive: { borderColor: colors.primary },
  profileMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  profileMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  field: { gap: 6 },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingRight: 44,
    color: colors.text,
    fontSize: 15,
  },
  eye: { position: 'absolute', right: 4, bottom: 6 },
  error: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(240,82,82,0.12)',
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  errorText: { color: colors.danger, flex: 1, fontSize: 14, lineHeight: 20 },
  disclaimer: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
