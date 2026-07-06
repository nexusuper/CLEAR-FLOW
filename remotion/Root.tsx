import React from "react";
import { Composition, Still } from "remotion";
import { WaterRefillProcess, Poster } from "./WaterRefillProcess";
import { VIDEO, TOTAL } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WaterRefillProcess"
        component={WaterRefillProcess}
        durationInFrames={TOTAL}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Still
        id="Poster"
        component={Poster}
        width={VIDEO.width}
        height={VIDEO.height}
      />
    </>
  );
};
