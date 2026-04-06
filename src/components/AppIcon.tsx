import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Entypo from 'react-native-vector-icons/Entypo';
import EvilIcons from 'react-native-vector-icons/EvilIcons';
import Feather from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Fontisto from 'react-native-vector-icons/Fontisto';
import Foundation from 'react-native-vector-icons/Foundation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Octicons from 'react-native-vector-icons/Octicons';
import SimpleLineIcons from 'react-native-vector-icons/SimpleLineIcons';
import Zocial from 'react-native-vector-icons/Zocial';

export type IconType =
  | 'AntDesign'
  | 'Entypo'
  | 'EvilIcons'
  | 'Feather'
  | 'FontAwesome'
  | 'FontAwesome5'
  | 'Fontisto'
  | 'Foundation'
  | 'Ionicons'
  | 'MaterialCommunityIcons'
  | 'MaterialIcons'
  | 'Octicons'
  | 'SimpleLineIcons'
  | 'Zocial';

interface AppIconProps {
  type?: IconType;
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const AppIcon: React.FC<AppIconProps> = ({
  type = 'Feather',
  name,
  size = 24,
  color = '#000',
  style,
  accessibilityLabel,
}) => {
  const getIconComponent = () => {
    switch (type) {
      case 'AntDesign': return AntDesign;
      case 'Entypo': return Entypo;
      case 'EvilIcons': return EvilIcons;
      case 'Feather': return Feather;
      case 'FontAwesome': return FontAwesome;
      case 'FontAwesome5': return FontAwesome5;
      case 'Fontisto': return Fontisto;
      case 'Foundation': return Foundation;
      case 'Ionicons': return Ionicons;
      case 'MaterialCommunityIcons': return MaterialCommunityIcons;
      case 'MaterialIcons': return MaterialIcons;
      case 'Octicons': return Octicons;
      case 'SimpleLineIcons': return SimpleLineIcons;
      case 'Zocial': return Zocial;
      default: return Feather;
    }
  };

  const IconComponent = getIconComponent();

  return (
    <View style={style}>
      <IconComponent
        name={name}
        size={size}
        color={color}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
};

export default AppIcon;
