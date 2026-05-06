import { MicIcon } from "./MicIcon";

type Props = {
  onUserText: (text: string) => Promise<void> | void;
  onUserVoice: () => void;
  onAgentReply: (text: string) => void;
  onError?: (message: string) => void;
};

// TODO: empty-state landing screen with a big mic CTA + text input.
export function HeroStart(_props: Props) {
  return (
    <section className="hero">
      <div className="hero-brand">
        <img src="/rocketride-icon-dark.svg" alt="RocketRide" />
        <p className="hero-brand-name">Cody Rider</p>
      </div>
      <h1 className="hero-title">what shall we build?</h1>
      <button type="button" className="hero-mic" disabled>
        <MicIcon size={38} />
      </button>
      <p className="hero-caption">TODO HeroStart — wire mic + input</p>
    </section>
  );
}
