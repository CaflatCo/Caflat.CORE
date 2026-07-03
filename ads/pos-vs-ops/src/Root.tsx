import "./index.css";
import { fontsReady } from "./fonts";
import { Composition } from "remotion";

// Referenced so the font-loading module can never be tree-shaken away.
void fontsReady;
import { ShowcaseAd, calculateShowcaseDuration } from "./ShowcaseAd";
import { Reel1, REEL1_DURATION } from "./reels/Reel1";
import { Reel2, REEL2_DURATION } from "./reels/Reel2";
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
      <Composition
        id="Reel1PosVsPlatform"
        component={Reel1}
        durationInFrames={REEL1_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Reel2LeakingMoney"
        component={Reel2}
        durationInFrames={REEL2_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
