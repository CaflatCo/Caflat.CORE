import "./index.css";
import { Composition } from "remotion";
import { ShowcaseAd, calculateShowcaseDuration } from "./ShowcaseAd";
import { WIDTH, HEIGHT, FPS } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FeatureShowcase"
        component={ShowcaseAd}
        durationInFrames={calculateShowcaseDuration()}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
