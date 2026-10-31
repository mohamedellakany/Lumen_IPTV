import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccountInfo } from '@/hooks/useCatalog';
import { useActiveProfile } from '@/store/profiles';
import { colors, radius, spacing, tvFocus } from '@/theme';
import { daysUntil } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;

// Fire TV is ~540dp tall, so the rail is tighter there to fit without scrolling.
const isTV = Platform.isTV;

export const NAV_ICONS: Record<string, [IconName, IconName]> = {
  home: ['home-outline', 'home'],
  live: ['tv-outline', 'tv'],
  movies: ['film-outline', 'film'],
  series: ['albums-outline', 'albums'],
  favorites: ['heart-outline', 'heart'],
};

/** Left navigation rail used instead of the bottom tab bar on tablets, desktop and TV. */
export function SideNav({ state, descriptors, emitter, navigateToTab, width }: BottomTabBarProps & { width: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.rail, { width, paddingTop: insets.top + (isTV ? spacing.lg : spacing.xl), paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={[styles.brand, isTV && styles.brandTV]}>
        <LinearGradient colors={['#5B8CFF', '#3A5BFF']} style={[styles.logo, isTV && styles.logoTV]}>
          <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
        </LinearGradient>
        <Text style={styles.brandText}>Lumen</Text>
      </View>

      <View style={styles.items}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [icon, activeIcon] = NAV_ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const label = descriptors[route.key].options.title ?? route.name;
          return (
            <NavItem
              key={route.key}
              label={label}
              icon={focused ? activeIcon : icon}
              active={focused}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
            />
          );
        })}
        <NavItem label="Settings" icon="settings-outline" onPress={() => router.push('/settings')} />
      </View>

      <AccountBadge />
    </View>
  );
}

function NavItem({ label, icon, active, onPress }: { label: string; icon: IconName; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, focused, hovered }) => [
        styles.item,
        isTV && styles.itemTV,
        (hovered || focused) && !active && styles.itemHover,
        active && styles.itemActive,
        pressed && { opacity: 0.8 },
        tvFocus(focused),
      ]}
    >
      <Ionicons name={icon} size={22} color={active ? '#fff' : colors.textDim} />
      <Text style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function AccountBadge() {
  const profile = useActiveProfile();
  const account = useAccountInfo();
  const expiresIn = daysUntil(account.data?.expiresAt);
  const connected = !!account.data && !account.error;
  const dot = account.isLoading ? colors.warning : connected ? colors.success : colors.danger;
  const status = account.isLoading ? 'Connecting…' : connected ? 'Connected' : 'Offline';
  const detail =
    expiresIn !== null && connected
      ? expiresIn <= 0
        ? 'Expired'
        : `${expiresIn} day${expiresIn === 1 ? '' : 's'} left`
      : (profile?.name ?? '');

  return (
    <View style={styles.badge}>
      <View style={styles.badgeRow}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.badgeStatus}>{status}</Text>
      </View>
      {!!detail && (
        <Text style={styles.badgeDetail} numberOfLines={1}>
          {detail}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    backgroundColor: '#0A0E1C',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.md,
  },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandTV: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  logoTV: { width: 36, height: 36, borderRadius: 10 },
  itemTV: { paddingVertical: spacing.sm },
  brandText: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  items: { flex: 1, gap: spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemHover: { backgroundColor: 'rgba(255,255,255,0.05)' },
  itemActive: {
    backgroundColor: '#2D5BFF',
    borderColor: '#6F93FF',
    shadowColor: '#3D6BFF',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  itemLabel: { color: colors.textDim, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  itemLabelActive: { color: '#fff', fontWeight: '700' },
  badge: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 2,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeStatus: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  badgeDetail: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
