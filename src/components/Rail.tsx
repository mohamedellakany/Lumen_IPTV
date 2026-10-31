import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

interface Props<T> {
  title: string;
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  action?: ReactElement;
  /** Tighter spacing, used by the one-screen TV home. */
  compact?: boolean;
}

/** Horizontal, titled row of cards used on the home screen. */
export function Rail<T>({ title, data, keyExtractor, renderItem, action, compact }: Props<T>) {
  if (data.length === 0) return null;
  return (
    <View style={compact ? styles.sectionCompact : styles.section}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        {action}
      </View>
      <FlatList
        horizontal
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => renderItem(item)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? styles.listCompact : styles.list}
        initialNumToRender={6}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sectionCompact: { marginTop: spacing.sm },
  headerCompact: { marginBottom: 4 },
  titleCompact: { fontSize: 14 },
  listCompact: { paddingHorizontal: spacing.lg, paddingVertical: 4, gap: spacing.sm },
});
