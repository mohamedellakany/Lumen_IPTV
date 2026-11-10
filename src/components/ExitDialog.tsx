import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, shade } from '@/theme';
import { Text } from '@/components/Text';

interface Props {
  visible: boolean;
  onStay: () => void;
  onExit: () => void;
}

/** "Exit the app?" confirmation in the app's own style, usable with a TV remote (Stay is focused first). */
export function ExitDialog({ visible, onStay, onExit }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.logo}>
            <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} />
          </View>
          <Text style={styles.title}>Leaving so soon?</Text>
          <Text style={styles.message}>Do you want to exit Lumen Player?</Text>
          <View style={styles.actions}>
            <DialogButton label="Stay" icon="arrow-back" primary preferredFocus onPress={onStay} />
            <DialogButton label="Exit" icon="power" onPress={onExit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DialogButton({
  label,
  icon,
  primary,
  preferredFocus,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  preferredFocus?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus={preferredFocus}
      onPress={onPress}
      style={({ focused, pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        focused && (primary ? styles.primaryFocused : styles.secondaryFocused),
        pressed && { opacity: 0.85 },
      ]}
    >
      {({ focused }) => (
        <>
          <Ionicons name={icon} size={20} color={primary ? colors.onPrimary : focused ? '#fff' : colors.textDim} />
          <Text style={[styles.buttonLabel, { color: primary ? colors.onPrimary : focused ? '#fff' : colors.textDim }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: shade(0.82), alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, alignSelf: 'stretch' },
  button: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
  },
  buttonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  primaryFocused: { borderColor: '#fff', transform: [{ scale: 1.05 }] },
  secondaryFocused: { backgroundColor: colors.danger, borderColor: '#fff', transform: [{ scale: 1.05 }] },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
});
