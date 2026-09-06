import {
  Image,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type PhotoZoomViewerProps = {
  imageUrls: { url: string }[];
  backgroundColor?: string;
  enableImageZoom?: boolean;
  enableSwipeDown?: boolean;
  maxScale?: number;
  minScale?: number;
  onSwipeDown?: () => void;
  renderIndicator?: () => React.ReactNode;
  saveToLocalByLongPress?: boolean;
  style?: StyleProp<ViewStyle>;
  useNativeDriver?: boolean;
};

export default function PhotoZoomViewer({
  imageUrls,
  backgroundColor = "black",
  maxScale = 4,
  minScale = 1,
  style,
}: PhotoZoomViewerProps) {
  const url = imageUrls[0]?.url;

  return (
    <View style={[{ flex: 1, width: "100%", backgroundColor }, style]}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
        maximumZoomScale={maxScale}
        minimumZoomScale={minScale}
      >
        {url ? (
          <Image
            source={{ uri: url }}
            resizeMode="contain"
            style={{ width: "100%", height: "100%", minHeight: 320 }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
