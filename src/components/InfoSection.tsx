import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

export function InfoSection({ plot, rows }: { plot?: string; rows: [string, string | undefined][] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = rows.filter(([, v]) => !!v);
  if (!plot && !visibleRows.length) return null;
  return (
    <View style={styles.section}>
      {!!plot && (
        <Text style={styles.plot} numberOfLines={expanded ? undefined : 4} onPress={() => setExpanded((e) => !e)}>
          {plot}
        </Text>
      )}
      {visibleRows.map(([label, value]) => (
        <Text key={label} style={styles.row} numberOfLines={2}>
          <Text style={styles.label}>{label}: </Text>
          {value}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm, maxWidth: 900 },
  plot: { color: colors.textDim, fontSize: 15, lineHeight: 22, marginBottom: spacing.sm },
  row: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  label: { color: colors.textMuted, fontWeight: '700' },
});
