import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageContentFit } from 'expo-image';
import { memo, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';
import { initials } from '@/utils/format';
import { Text } from '@/components/Text';

interface Props {
  uri?: string;
  name: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  icon?: keyof typeof Ionicons.glyphMap;
  blurRadius?: number;
}

/** Remote image with a graceful placeholder when the URL is missing or broken (common with IPTV logos). */
export const Artwork = memo(function Artwork({ uri, name, style, contentFit = 'cover', icon, blurRadius }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;
  return (
    <View style={[styles.box, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={Platform.isTV ? 0 : 150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          blurRadius={blurRadius}
          onError={() => setFailed(true)}
        />
      ) : icon ? (
        <Ionicons name={icon} size={22} color={colors.textMuted} />
      ) : (
        <Text style={styles.initials} numberOfLines={1}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
});
