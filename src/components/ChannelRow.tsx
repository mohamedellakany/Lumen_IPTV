import { Ionicons } from '@expo/vector-icons';
import { memo, type ComponentRef, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { LiveChannel } from '@/api/types';
import { colors, radius, spacing, tvFocus } from '@/theme';
import { Artwork } from './Artwork';

export const CHANNEL_ROW_HEIGHT = Platform.isTV ? 52 : 68;

interface Props {
  channel: LiveChannel;
  favorite: boolean;
  active?: boolean;
  /** Give this row the initial TV remote focus. */
  preferredFocus?: boolean;
  onPress: (channel: LiveChannel) => void;
  onToggleFavorite: (channel: LiveChannel) => void;
  /** Ref to the row's main button, e.g. as a TV focus destination. */
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

export const ChannelRow = memo(function ChannelRow({ channel, favorite, active, preferredFocus, onPress, onToggleFavorite, ref }: Props) {
  return (
    <View style={[styles.row, active && styles.active]}>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={channel.name}
        hasTVPreferredFocus={preferredFocus}
        onPress={() => onPress(channel)}
        style={({ pressed, focused }) => [styles.main, pressed && { opacity: 0.7 }, focused && styles.mainFocused]}
      >
        {channel.num !== undefined && <Text style={styles.num}>{channel.num}</Text>}
        <Artwork uri={channel.logo} name={channel.name} style={styles.logo} contentFit="contain" icon="tv-outline" />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.hasArchive && <Text style={styles.badge}>Catch-up</Text>}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
        hitSlop={10}
        onPress={() => onToggleFavorite(channel)}
        style={({ focused }) => [styles.favButton, tvFocus(focused)]}
      >
        <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? colors.accent : colors.textMuted} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    height: CHANNEL_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  active: { backgroundColor: colors.primaryDim },
  main: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.lg },
  mainFocused: { backgroundColor: colors.primary },
  num: { color: colors.textMuted, width: 34, fontSize: 12, fontVariant: ['tabular-nums'] },
  logo: Platform.isTV
    ? { width: 54, height: 36, borderRadius: radius.sm, backgroundColor: colors.surface }
    : { width: 64, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface },
  info: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: Platform.isTV ? 14 : 15, fontWeight: '600' },
  badge: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  favButton: { padding: spacing.sm },
});
