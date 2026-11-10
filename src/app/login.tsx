import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeHost, parseXtreamM3uUrl } from '@/api/parsers';
import { createProvider } from '@/api/provider';
import type { Profile } from '@/api/types';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, IconButton } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { useLibraryStore } from '@/store/library';
import { useProfiles } from '@/store/profiles';
import { colors, fontFamily, radius, shade, spacing, tvFocus } from '@/theme';
import { Text } from '@/components/Text';
import { PosterWall } from '@/components/PosterWall';

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
  const { width, height } = useWindowDimensions();

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

  // Wide screens (TV, tablets, phones held sideways) put two fields per row so the card fits one screen.
  const wide = width >= 640;
  const short = height < 520;

  const xtreamFields = (
    <>
      <View style={wide ? styles.pair : undefined}>
        <Field label="Playlist name (optional)" value={name} onChangeText={setName} placeholder="My IPTV" compact={short} />
        <Field
          label="Server URL"
          value={host}
          onChangeText={setHost}
          placeholder="http://example.com:8080"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          compact={short}
        />
      </View>
      <View style={wide ? styles.pair : undefined}>
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          compact={short}
        />
        <View style={styles.flex}>
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            onSubmitEditing={canSubmit ? submit : undefined}
            compact={short}
          />
          <IconButton
            icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            label={showPassword ? 'Hide password' : 'Show password'}
            color={colors.textMuted}
            size={20}
            onPress={() => setShowPassword((v) => !v)}
            style={[styles.eye, short && styles.eyeCompact]}
          />
        </View>
      </View>
    </>
  );

  const m3uFields = (
    <View style={wide ? styles.pair : undefined}>
      <Field label="Playlist name (optional)" value={name} onChangeText={setName} placeholder="My IPTV" compact={short} />
      <Field
        label="Playlist URL"
        value={m3uUrl}
        onChangeText={setM3uUrl}
        placeholder="http://example.com/get.php?username=…&type=m3u_plus"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={canSubmit ? submit : undefined}
        compact={short}
        grow={2}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <PosterWall />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, wide && styles.cardWide, short && styles.cardShort]}>
            <View style={styles.header}>
              {router.canGoBack() && <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} style={styles.back} />}
              <BrandLogo size={short ? 36 : 48} />
              <View style={styles.flex}>
                <Text style={[styles.title, short && styles.titleShort]}>Lumen</Text>
                {!short && <Text style={styles.subtitle}>Add your IPTV playlist to start watching</Text>}
              </View>
            </View>

            {profiles.length > 0 && (
              // Saved playlists: tap to open, the small bin removes it.
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsRow}>
                {profiles.map((p) => (
                  <View key={p.id} style={[styles.chip, p.id === activeId && styles.chipActive]}>
                    <Pressable
                      accessibilityLabel={`Open ${p.name}`}
                      onPress={() => enter(p.id)}
                      style={({ pressed, focused }) => [styles.chipMain, pressed && { opacity: 0.7 }, tvFocus(focused)]}
                    >
                      <Ionicons name="play" size={14} color={colors.primary} />
                      <Text style={styles.chipText} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </Pressable>
                    <IconButton icon="trash-outline" size={15} color={colors.textMuted} label={`Delete ${p.name}`} onPress={() => removeProfile(p)} />
                  </View>
                ))}
              </ScrollView>
            )}

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

            {mode === 'xtream' ? xtreamFields : m3uFields}

            {error && (
              <View style={styles.error}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button title="Connect" icon="log-in-outline" onPress={submit} loading={loading} disabled={!canSubmit} style={short && styles.connectShort} />
            <Text style={styles.disclaimer} numberOfLines={2}>
              Lumen Player does not provide any content. Use it with playlists and subscriptions you are authorized to access.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, compact, grow = 1, ...props }: TextInputProps & { label: string; compact?: boolean; grow?: number }) {
  return (
    <View style={[styles.field, { flex: grow }]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, compact && styles.inputCompact]} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 24,
    backgroundColor: shade(0.78),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cardWide: { maxWidth: 760 },
  cardShort: { padding: spacing.md, gap: spacing.sm, borderRadius: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { marginRight: -spacing.xs },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  titleShort: { fontSize: 20 },
  subtitle: { color: colors.textDim, fontSize: 14, marginTop: 1 },
  chipsRow: { flexGrow: 0 },
  chips: { gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.primary },
  chipMain: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderRadius: radius.pill },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '700', maxWidth: 180 },
  segment: { marginHorizontal: -spacing.lg },
  pair: { flexDirection: 'row', gap: spacing.md },
  field: { gap: 5 },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  labelCompact: { fontSize: 11 },
  input: {
    fontFamily: fontFamily(400),
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
  inputCompact: { height: 40, fontSize: 14 },
  eye: { position: 'absolute', right: 4, bottom: 6 },
  eyeCompact: { bottom: 2 },
  connectShort: { minHeight: 42 },
  error: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(240,82,82,0.12)',
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  errorText: { color: colors.danger, flex: 1, fontSize: 13, lineHeight: 18 },
  disclaimer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
