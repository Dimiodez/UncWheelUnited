import {rankedRun} from './RankedRun';
const HIGH_SCORE_KEY = "ufl.sandy-uppy.high-score.v1";

export const highScoreStore = {
  load() {
    if(rankedRun.published)return 0;
    try {
      return Math.max(0, Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0);
    } catch {
      return 0;
    }
  },
  save(score: number) {
    if(rankedRun.published)return;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(Math.max(0, Math.round(score))));
    } catch {
      // Test storage may be unavailable in private browsing; gameplay should continue.
    }
  }
};
