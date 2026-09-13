import { useThemeColor } from 'heroui-native';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop, Text as SvgText, TSpan } from 'react-native-svg';

interface BrandLogoProps {
  size?: number;
}

/** Theme-native vector recreation of the supplied Train the Train logo artwork. */
export function BrandLogo({ size = 88 }: BrandLogoProps) {
  const [accent, link, foreground, surface, muted] = useThemeColor([
    'accent',
    'link',
    'foreground',
    'surface',
    'muted',
  ]);

  return (
    <View
      accessible
      accessibilityLabel="Train the Train — Ladies on Track. Predict, optimize, improve."
      style={{ height: size, width: size }}
    >
      <Svg height={size} viewBox="0 0 400 400" width={size}>
        <Defs>
          <LinearGradient id="logoGreen" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity="0.72" />
            <Stop offset="0.55" stopColor={accent} />
            <Stop offset="1" stopColor={link} />
          </LinearGradient>
          <LinearGradient id="logoBlue" x1="0" x2="0.7" y1="0" y2="1">
            <Stop offset="0" stopColor={link} stopOpacity="0.45" />
            <Stop offset="0.45" stopColor={link} />
            <Stop offset="1" stopColor={foreground} />
          </LinearGradient>
          <LinearGradient id="trainBand" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={accent} />
            <Stop offset="0.58" stopColor={accent} />
            <Stop offset="1" stopColor={link} />
          </LinearGradient>
        </Defs>

        {/* Two arrows form one complete ring around the train. */}
        <G>
          <Path
            d="M101 151A107 107 0 0 1 236 38"
            fill="none"
            stroke="url(#logoGreen)"
            strokeLinecap="square"
            strokeWidth="31"
          />
          <Path d="M225 16l49 39-49 38z" fill="url(#logoGreen)" />
          <Path
            d="M269 58A107 107 0 0 1 154 252"
            fill="none"
            stroke="url(#logoBlue)"
            strokeLinecap="square"
            strokeWidth="31"
          />
          <Path d="M166 224l-49 37 48 40z" fill="url(#logoBlue)" />
          <Path
            d="M139 256a107 107 0 0 1-42-48"
            fill="none"
            stroke="url(#logoGreen)"
            strokeLinecap="square"
            strokeOpacity="0.55"
            strokeWidth="25"
          />
        </G>

        {/* High-speed train, centred inside and crossing the circular mark. */}
        <G>
          <Path
            d="M44 190c48-21 94-48 139-77 25-16 45-24 68-21 35 4 61 26 82 66 9 17 12 37 6 50-7 14-25 22-54 22-34 0-68-6-101-17-38-12-84-15-140-11l50-18z"
            fill={surface}
            stroke={foreground}
            strokeLinejoin="round"
            strokeWidth="5"
          />
          <Path
            d="M181 113c26-17 49-22 70-17 33 7 56 29 74 65-23 4-43 1-57-10-9-7-17-17-27-30-18-22-36-27-60-8z"
            fill={foreground}
          />
          <Path d="M251 105c25 5 44 19 59 43-19 1-32-3-41-11z" fill={link} opacity="0.55" />
          <Path d="M102 166l16-9v25l-16 5z" fill={foreground} />
          <Path d="M124 153l20-12v34l-20 6z" fill={foreground} />
          <Path d="M151 137l24-15v44l-24 7z" fill={foreground} />
          <Path d="M182 119c15-8 28-7 39 5l22 29-61 14z" fill={foreground} />
          <Path
            d="M44 194c60-12 111-21 153-22 28-1 48 7 66 17 20 11 42 15 68 12-11 16-31 22-61 20-29-1-57-8-86-17-39-12-86-15-140-10z"
            fill="url(#trainBand)"
          />
          <Path
            d="M44 203c68 0 125 8 171 24l108 17-9 13-105-19c-45-16-100-28-165-35z"
            fill={foreground}
          />
          <Path
            d="M61 218c58 8 107 20 148 35l88 20-9 11-85-21c-42-16-89-31-142-45z"
            fill={muted}
            opacity="0.72"
          />
          <Path
            d="M318 163c7-1 11 4 10 11-1 7-5 11-10 10-5 0-8-5-7-10 1-6 3-10 7-11z"
            fill={surface}
          />
        </G>

        {/* Reference wordmark: one line, centred, with the green middle word. */}
        <SvgText
          fill={foreground}
          fontFamily="Inter_700Bold"
          fontSize="38"
          fontWeight="700"
          letterSpacing="-1"
          textAnchor="middle"
          x="200"
          y="327"
        >
          <TSpan>TRAIN </TSpan>
          <TSpan fill={accent}>THE</TSpan>
          <TSpan> TRAIN</TSpan>
        </SvgText>

        <Path d="M20 350h52M328 350h52" stroke={foreground} strokeWidth="1.5" />
        <SvgText
          fill={foreground}
          fontFamily="Inter_500Medium"
          fontSize="13"
          fontWeight="500"
          letterSpacing="5.5"
          textAnchor="middle"
          x="200"
          y="355"
        >
          LADIES ON TRACK
        </SvgText>

        <SvgText
          fill={muted}
          fontFamily="Inter_600SemiBold"
          fontSize="10"
          fontWeight="600"
          letterSpacing="2.5"
          textAnchor="middle"
          x="200"
          y="385"
        >
          PREDICT <TSpan fill={link}>• OPTIMIZE</TSpan> <TSpan fill={accent}>• IMPROVE</TSpan>
        </SvgText>
      </Svg>
    </View>
  );
}
