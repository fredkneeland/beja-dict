import { FontAwesome } from '@expo/vector-icons';
import * as React from 'react';
import { TouchableOpacity } from 'react-native';

export function CopyButton({ onPress, size = 22, color = '#888', style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[{ padding: 6, marginLeft: 8, alignSelf: 'center' }, style]}
      accessibilityRole="button"
      accessibilityLabel="Copy to clipboard"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <FontAwesome name="copy" size={size} color={color} />
    </TouchableOpacity>
  );
}
