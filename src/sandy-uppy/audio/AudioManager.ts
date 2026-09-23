export class AudioManager {
  private context?: AudioContext;

  private tone(frequency: number, duration: number, volume = 0.045, type: OscillatorType = "square") {
    try {
      this.context ??= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    } catch {
      // Audio is optional and may be blocked until a user gesture.
    }
  }

  touch(combo: number) { this.tone(270 + Math.min(combo, 12) * 20, 0.08); }
  drop() { this.tone(115, 0.18, 0.06, "sawtooth"); }
  obstacle() { this.tone(85, 0.12, 0.04, "square"); }
  gameOver() { this.tone(145, 0.45, 0.06, "triangle"); }
}
