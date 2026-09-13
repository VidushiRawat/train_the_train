import { Image } from 'react-native';

interface BrandLogoProps {
  size?: number;
}

const LOGO_SOURCE = require('../../assets/train-the-train-logo.png');

/** Displays the supplied Train the Train artwork on every native platform. */
export function BrandLogo({ size = 88 }: BrandLogoProps) {
  return (
    <Image
      accessible
      accessibilityLabel="Train the Train — Ladies on Track. Predict, optimize, improve."
      resizeMode="contain"
      source={LOGO_SOURCE}
      style={{ height: size, width: size }}
    />
  );
}
