import { Children, isValidElement, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { fontFamily, hasArabic } from '@/theme';

/** The plain text inside `children` (nested Text included), to tell Arabic from Latin. */
function textOf(children: ReactNode): string {
  let out = '';
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') out += child;
    else if (isValidElement<{ children?: ReactNode }>(child)) out += textOf(child.props.children);
  });
  return out;
}

/** Font for a text style: Exo 2, or Cairo when the text contains Arabic, at the style's weight. */
export function appFont(style: TextProps['style'], text: string) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return null; // an explicit font wins
  // The weight is baked into the family; a fontWeight on top would make platforms fake a bolder face.
  return { fontFamily: fontFamily(flat.fontWeight, hasArabic(text)), fontWeight: 'normal' as const };
}

/** Drop-in replacement for React Native's Text that uses the app fonts. */
export function Text({ style, children, ref, ...rest }: TextProps & { ref?: Ref<ComponentRef<typeof RNText>> }) {
  return (
    <RNText ref={ref} {...rest} style={[style, appFont(style, textOf(children))]}>
      {children}
    </RNText>
  );
}
