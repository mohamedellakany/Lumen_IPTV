import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useAccountInfo, useRefreshCatalog } from '@/hooks/useCatalog';
import { libraryActions } from '@/store/library';
import { useActiveProfile, useProfiles } from '@/store/profiles';
import { useSettings } from '@/store/settings';
import { colors, radius, spacing, tvFocus } from '@/theme';
import { formatDate } from '@/utils/format';

function confirmAction(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useActiveProfile();
  const setActive = useProfiles((s) => s.setActive);
  const account = useAccountInfo();
  const { refresh, refreshing } = useRefreshCatalog();
  const settings = useSettings();
  const [proxyDraft, setProxyDraft] = useState(settings.webProxyUrl);

  const a = account.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Account">
        <Row icon="person-circle-outline" label="Playlist" value={profile?.name} />
        {profile?.type === 'xtream' ? (
          <>
            <Row icon="server-outline" label="Server" value={profile.host} />
            <Row icon="person-outline" label="Username" value={profile.username} />
            <Row
              icon="pulse-outline"
              label="Status"
              value={account.isLoading ? 'Checking…' : account.error ? 'Unavailable' : `${a?.status ?? 'Unknown'}${a?.isTrial ? ' (trial)' : ''}`}
            />
            <Row icon="calendar-outline" label="Expires" value={a ? formatDate(a.expiresAt) : '—'} />
            <Row
              icon="people-outline"
              label="Connections"
              value={a?.maxConnections !== undefined ? `${a.activeConnections ?? 0} / ${a.maxConnections}` : '—'}
            />
          </>
        ) : (
          <>
            <Row icon="link-outline" label="URL" value={profile?.url} />
            <Row icon="stats-chart-outline" label="Content" value={a?.summary ?? '—'} />
          </>
        )}
      </Section>

      <Section title="Playback">
        {Platform.OS !== 'ios' && (
          <Row icon="radio-outline" label="Live stream format" hint="Try MPEG-TS if live channels stutter or fail to start.">
            <View style={styles.toggleGroup}>
              {(['m3u8', 'ts'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => settings.set({ liveFormat: f })}
                  style={({ focused }) => [styles.toggle, settings.liveFormat === f && styles.toggleActive, tvFocus(focused)]}
                >
                  <Text style={[styles.toggleText, settings.liveFormat === f && { color: '#fff' }]}>{f === 'm3u8' ? 'HLS' : 'MPEG-TS'}</Text>
                </Pressable>
              ))}
            </View>
          </Row>
        )}
        <Row icon="play-forward-outline" label="Autoplay next episode">
          <Switch value={settings.autoplayNext} onValueChange={(v) => settings.set({ autoplayNext: v })} trackColor={{ true: colors.primary }} />
        </Row>
      </Section>

      <Section title="Content">
        <Row icon="eye-off-outline" label="Hide adult categories" hint="Hides categories with names like Adult, XXX or 18+.">
          <Switch value={settings.hideAdult} onValueChange={(v) => settings.set({ hideAdult: v })} trackColor={{ true: colors.primary }} />
        </Row>
        <Row
          icon="refresh-outline"
          label={refreshing ? 'Refreshing…' : 'Refresh playlist'}
          hint="Reload channels, movies and series from the server."
          onPress={async () => {
            const result = await refresh();
            if (result.ok) router.back();
            else if (Platform.OS === 'web') window.alert(result.message);
            else Alert.alert('Refresh failed', result.message);
          }}
        />
        <Row
          icon="time-outline"
          label="Clear watch history"
          onPress={() => confirmAction('Clear history', 'Remove watch history and resume positions?', 'Clear', () => libraryActions().clearHistory())}
        />
        <Row
          icon="heart-dislike-outline"
          label="Clear favorites"
          onPress={() => confirmAction('Clear favorites', 'Remove all favorites for this playlist?', 'Clear', () => libraryActions().clearFavorites())}
        />
      </Section>

      {Platform.OS === 'web' && (
        <Section title="Browser">
          <View style={styles.proxyBox}>
            <Text style={styles.label}>Streaming proxy URL</Text>
            <Text style={styles.hint}>
              Browsers block direct access to most IPTV servers. Run `npm run proxy` and keep this at http://localhost:8787. Leave empty only if your
              server sends CORS headers.
            </Text>
            <TextInput
              value={proxyDraft}
              onChangeText={setProxyDraft}
              onBlur={() => {
                settings.set({ webProxyUrl: proxyDraft.trim() });
                queryClient.invalidateQueries();
              }}
              placeholder="http://localhost:8787"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
        </Section>
      )}

      <Section title="Playlists">
        <Row icon="swap-horizontal-outline" label="Switch or add playlist" onPress={() => router.push('/login')} />
        <Row
          icon="log-out-outline"
          label="Sign out"
          danger
          onPress={() =>
            confirmAction('Sign out', 'Your playlist stays saved on this device.', 'Sign out', () => {
              setActive(null);
              router.replace('/login');
            })
          }
        />
      </Section>

      <Text style={styles.version}>
        Lumen Player {Constants.expoConfig?.version ?? ''} · {Platform.OS}
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  hint,
  onPress,
  danger,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  danger?: boolean;
  children?: ReactNode;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed, focused }) => [styles.row, pressed && { opacity: 0.6 }, focused && styles.rowFocused]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textDim} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      {value !== undefined && (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {children}
      {onPress && !children && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { color: colors.text, fontSize: 15 },
  rowFocused: { backgroundColor: colors.surfaceAlt },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  value: { color: colors.textDim, fontSize: 14, maxWidth: '50%' },
  toggleGroup: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 },
  toggle: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  toggleActive: { backgroundColor: colors.primary },
  toggleText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  proxyBox: { padding: spacing.lg, gap: spacing.sm },
  input: {
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
