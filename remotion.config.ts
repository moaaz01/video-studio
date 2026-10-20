import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
// Arabic faces are loaded from public/fonts; give a slow laptop headroom.
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setConcurrency(4);
