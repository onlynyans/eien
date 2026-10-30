// The next frame of a turn (#40, Phase 3), or a timer behind it: where
// frames stall (a window behind another, a throttled pane) the turn still
// lands. Whichever comes first runs, and the other is called off.

/** The timer behind each frame: two frames' time, so it only runs where frames don't. */
const FALLBACK_MS = 34;

/** Runs `run` with the time at the next frame (or the timer); the returned function calls it off. */
export type Frames = (run: (now: number) => void) => () => void;

export const nextFrame: Frames = (run) => {
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    run(performance.now());
  };
  const frame = requestAnimationFrame(once);
  const timer = setTimeout(once, FALLBACK_MS);
  return () => {
    done = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
};
