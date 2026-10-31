import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.isTV ? spacing.sm : spacing.md,
    paddingBottom: Platform.isTV ? spacing.sm : spacing.md,
    gap: spacing.md,
  },
  titles: { flex: 1 },
  title: { color: colors.text, fontSize: Platform.isTV ? 20 : 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
