import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/BrandLogo';
import { Glyph, SECTION_ICONS, type GlyphName } from '@/components/Glyph';
import { useAccountInfo } from '@/hooks/useCatalog';
import { useActiveProfile } from '@/store/profiles';
import { colors, radius, spacing, tvFocus } from '@/theme';
import { daysUntil } from '@/utils/format';
import { Text } from '@/components/Text';

// Fire TV is ~540dp tall, so the rail is tighter there to fit without scrolling.
const isTV = Platform.isTV;

const FALLBACK_ICON: [GlyphName, GlyphName] = [
  { family: 'ion', name: 'ellipse-outline' },
  { family: 'ion', name: 'ellipse' },
];
const SETTINGS_ICON: GlyphName = { family: 'ion', name: 'settings-outline' };

/** Left navigation rail used instead of the bottom tab bar on tablets, desktop and TV. */
/** `compact`: icons only, for phones held sideways. */
export function SideNav({ state, descriptors, emitter, navigateToTab, width, compact }: BottomTabBarProps & { width: number; compact?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.rail,
        compact && styles.railCompact,
        {
          width,
          paddingLeft: insets.left + (compact ? spacing.sm : spacing.md),
          paddingTop: insets.top + (compact ? spacing.md : isTV ? spacing.lg : spacing.xl),
          paddingBottom: insets.bottom + (compact ? spacing.sm : spacing.lg),
        },
      ]}
    >
      <View style={[styles.brand, isTV && styles.brandTV, compact && styles.brandCompact]}>
        <BrandLogo size={compact ? 40 : isTV ? 38 : 52} />
        {!compact && <Text style={styles.brandText}>Lumen</Text>}
      </View>

      <View style={styles.items}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [icon, activeIcon] = SECTION_ICONS[route.name] ?? FALLBACK_ICON;
          const label = descriptors[route.key].options.title ?? route.name;
          return (
            <NavItem
              key={route.key}
              label={label}
              icon={focused ? activeIcon : icon}
              active={focused}
              compact={compact}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
            />
          );
        })}
        <NavItem label="Settings" icon={SETTINGS_ICON} compact={compact} onPress={() => router.push('/settings')} />
      </View>

      <AccountBadge compact={compact} />
    </View>
  );
}

function NavItem({ label, icon, active, compact, onPress }: { label: string; icon: GlyphName; active?: boolean; compact?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, focused, hovered }) => [
        styles.item,
        isTV && styles.itemTV,
        compact && styles.itemCompact,
        (hovered || focused) && !active && styles.itemHover,
        active && styles.itemActive,
        pressed && { opacity: 0.8 },
        tvFocus(focused),
      ]}
    >
      <Glyph icon={icon} size={22} color={active ? '#fff' : colors.textDim} />
      {!compact && (
        <Text style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function AccountBadge({ compact }: { compact?: boolean }) {
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

  // Compact rail: just the connection dot.
  if (compact) {
    return (
      <View style={styles.badgeCompact} accessibilityLabel={`${status}${detail ? `, ${detail}` : ''}`}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
    );
  }
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
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.md,
  },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  railCompact: { paddingRight: spacing.sm },
  brandCompact: { marginBottom: spacing.md },
  itemCompact: { justifyContent: 'center', paddingHorizontal: 0, paddingVertical: spacing.sm },
  badgeCompact: { alignItems: 'center', paddingVertical: spacing.sm },
  brandTV: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
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
    backgroundColor: colors.primaryDim,
    borderColor: 'transparent',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
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
