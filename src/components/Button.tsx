import { Ionicons } from '@expo/vector-icons';
import type { ComponentRef, Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, tvFocus } from '@/theme';
import { Text } from '@/components/Text';

type IconName = keyof typeof Ionicons.glyphMap;

interface ButtonProps {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onFocus?: () => void;
  ref?: Ref<ComponentRef<typeof Pressable>>;
  /** TV: take the remote's focus when this button first appears. */
  preferredFocus?: boolean;
}

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style, onFocus, ref, preferredFocus }: ButtonProps) {
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? '#fff' : colors.text;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      hasTVPreferredFocus={preferredFocus}
      onFocus={onFocus}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, focused }) => [
        styles.button,
        tvFocus(focused),
        styles[variant],
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.label, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
  onFocus?: () => void;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

export function IconButton({ icon, onPress, size = 22, color = colors.text, label, style, onFocus, ref }: IconButtonProps) {
  return (
    <Pressable
      ref={ref}
      onFocus={onFocus}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed, focused }) => [styles.iconButton, pressed && { opacity: 0.6 }, style, tvFocus(focused)]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
  label: { fontSize: 15, fontWeight: '700' },
  iconButton: { padding: spacing.sm, borderRadius: radius.pill },
});
