import { useThemeColor } from 'heroui-native';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Text as SvgText, TSpan } from 'react-native-svg';

interface BrandLogoProps {
  size?: number;
}

/** Theme-native recreation of the supplied Train the Train logo artwork. */
export function BrandLogo({ size = 72 }: BrandLogoProps) {
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
      <Svg height={size} viewBox="0 0 360 360" width={size}>
        <Defs>
          <LinearGradient id="greenArrow" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={accent} />
            <Stop offset="1" stopColor={link} />
          </LinearGradient>
          <LinearGradient id="blueArrow" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={link} />
            <Stop offset="1" stopColor={foreground} />
          </LinearGradient>
          <LinearGradient id="trainStripe" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={link} />
            <Stop offset="1" stopColor={accent} />
          </LinearGradient>
        </Defs>

        {/* Circular arrows */}
        <Path
          d="M72 145C68 78 122 23 208 25V7l58 48-58 46V76c-58 0-99 30-108 75z"
          fill="url(#greenArrow)"
        />
        <Path
          d="M270 75c38 50 43 123 6 177-13 18-29 33-49 44v23l-58-47 58-47v24c37-28 51-72 38-113-5-17-14-32-27-45z"
          fill="url(#blueArrow)"
        />

        {/* Streamlined train body */}
        <Path
          d="M43 202c49-20 101-50 149-82 22-15 42-18 63-13 28 7 51 32 64 70 7 22 6 45-9 56-15 10-45 12-80 7l-80-12-107-5 63-15z"
          fill={surface}
          stroke={foreground}
          strokeLinejoin="round"
          strokeWidth="7"
        />
        <Path d="M190 120c24-15 47-15 68-3 18 11 34 32 44 60-28 2-46-4-57-18z" fill={foreground} />
        <Path d="M258 122c14 9 26 24 35 44-17-1-27-6-34-16l-18-24z" fill={link} />
        <Path
          d="M60 203c53-20 101-47 137-70l28 42c12 19 27 31 47 37-35 4-66 1-94-7l-56-16z"
          fill={surface}
        />
        <Path d="M92 190l22-12v23l-22 5z" fill={foreground} />
        <Path d="M121 175l25-14v33l-25 6z" fill={foreground} />
        <Path d="M154 156l29-17v45l-29 7z" fill={foreground} />
        <Path d="M191 135c12-7 23-6 32 3l19 28-51 13z" fill={foreground} />
        <Path
          d="M44 215c71-12 126-19 166-18 27 1 47 8 68 14-32 10-66 11-101 4-41-8-87-7-133 0z"
          fill="url(#trainStripe)"
        />
        <Path
          d="M52 228c69-2 130 5 184 22l55 8-8 13-60-11c-53-16-109-25-171-32z"
          fill={foreground}
        />
        <Path d="M62 238c61 7 113 18 157 34l50 11-8 11-49-12c-45-17-95-32-150-44z" fill={muted} />
        <Path
          d="M296 177c8 0 12 6 10 14-2 7-7 11-13 10-6-2-8-7-5-14 2-6 5-10 8-10z"
          fill={surface}
        />

        {/* Wordmark and straplines */}
        <SvgText
          fill={foreground}
          fontFamily="Inter_700Bold"
          fontSize="31"
          fontWeight="700"
          textAnchor="middle"
          x="180"
          y="307"
        >
          <TSpan>TRAIN </TSpan>
          <TSpan fill={accent}>THE</TSpan>
          <TSpan> TRAIN</TSpan>
        </SvgText>
        <Path d="M27 326h49M284 326h49" stroke={foreground} strokeWidth="2" />
        <SvgText
          fill={foreground}
          fontFamily="Inter_500Medium"
          fontSize="11"
          fontWeight="500"
          letterSpacing="5"
          textAnchor="middle"
          x="180"
          y="330"
        >
          LADIES ON TRACK
        </SvgText>
        <SvgText
          fill={link}
          fontFamily="Inter_600SemiBold"
          fontSize="7.5"
          fontWeight="600"
          letterSpacing="2"
          textAnchor="middle"
          x="180"
          y="349"
        >
          PREDICT · OPTIMIZE · <TSpan fill={accent}>IMPROVE</TSpan>
        </SvgText>
      </Svg>
    </View>
  );
}
