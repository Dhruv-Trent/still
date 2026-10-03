import Link from "next/link";
import {
  ArrowRight,
  Check,
  CalendarDays,
  Cloud,
  ShieldCheck,
  Smartphone,
  Bell,
} from "lucide-react";
export default function Home() {
  return (
    <div className="landing">
      <header className="public-nav">
        <Link href="/" className="brand">
          <span className="brandmark">
            <Check size={23} />
          </span>
          still<span className="brand-dot">.</span>
        </Link>
        <nav>
          <a href="#why">Why Still</a>
          <Link href="/auth">Log in</Link>
          <Link className="button primary" href="/auth?mode=signup">
            Get started <ArrowRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span /> A LITTLE CLARITY, EVERY DAY
          </div>
          <h1>
            Less on your mind.
            <br />
            <span>More in your day.</span>
          </h1>
          <p>
            Your tasks, plans, and small reminders.
            <br />
            Together in one beautifully quiet place.
          </p>
          <div className="hero-actions">
            <Link href="/auth?mode=signup" className="button primary">
              Make room for what matters <ArrowRight size={18} />
            </Link>
            <a href="#preview" className="text-link">
              Take a look ↓
            </a>
          </div>
          <div className="hero-note">
            Your space. Your pace. No distractions.
          </div>
        </section>
        <section
          id="preview"
          className="product-preview"
          aria-label="Illustrative product preview"
        >
          <aside>
            <div className="brand">still.</div>
            <div>
              ▣ &nbsp; Inbox <span>3</span>
            </div>
            <div className="selected">
              ☀ &nbsp; Today <span>4</span>
            </div>
            <div>▦ &nbsp; Upcoming</div>
            <div>✓ &nbsp; Completed</div>
            <small>MY LISTS</small>
            <div>▤ &nbsp; Personal</div>
            <div>▤ &nbsp; Work</div>
          </aside>
          <div className="preview-content">
            <div className="eyebrow">MONDAY, AT YOUR OWN PACE</div>
            <h2>A little focus goes a long way.</h2>
            <p className="muted">A preview of a more collected day.</p>
            <div className="preview-stats">
              <span>
                <strong>4</strong> to do today
              </span>
              <span>
                <strong>2</strong> already done
              </span>
              <div className="progress">
                <i style={{ width: "34%" }} />
              </div>
            </div>
            <h3>
              Today <span className="pill">4</span>
            </h3>
            {[
              [
                "Make a little space for the week",
                "Personal · 9:00 AM",
                "High",
              ],
              ["Finish the project proposal", "Work · 11:00 AM", "Medium"],
              ["Take a walk, leave the phone", "Personal · 5:30 PM", ""],
              ["Pick up something fresh for dinner", "Personal", ""],
            ].map(([t, s, p]) => (
              <div className="preview-task" key={t}>
                <span className="empty-check" />
                <div>
                  <strong>{t}</strong>
                  <small>{s}</small>
                </div>
                {p && <span className="pill">{p}</span>}
              </div>
            ))}
            <div className="preview-caption">
              Illustrative tasks — your workspace starts empty.
            </div>
          </div>
        </section>
        <section id="why" className="benefits">
          <div className="eyebrow">A CLEARER KIND OF PRODUCTIVITY</div>
          <h2>
            Everything you need.
            <br />
            Space to breathe.
          </h2>
          <div className="benefit-grid">
            {[
              [
                CalendarDays,
                "A plan that fits your life",
                "See today clearly, make room for tomorrow, and keep the bigger picture in view.",
              ],
              [
                Bell,
                "Remember the little things",
                "Schedule reminders and repeat the routines you want to keep.",
              ],
              [
                Cloud,
                "Pick up where you left off",
                "Keep your tasks together across devices, with a queue for offline changes.",
              ],
              [
                Smartphone,
                "At home on every screen",
                "Install Still on your phone, tablet, or desktop. No app store needed.",
              ],
              [
                ShieldCheck,
                "A space that’s yours",
                "Private accounts, database access controls, and no advertising trackers.",
              ],
              [
                Check,
                "Simple from the first task",
                "Start with a title. Add the details when you need them.",
              ],
            ].map(([Icon, title, description]) => {
              const I = Icon as typeof Check;
              return (
                <article key={String(title)}>
                  <I size={23} />
                  <h3>{String(title)}</h3>
                  <p>{String(description)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="final-cta">
          <h2>One less thing to keep in your head.</h2>
          <Link className="button primary" href="/auth?mode=signup">
            Find your focus <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer>
        <Link className="brand" href="/">
          still.
        </Link>
        <span>A little clarity, every day.</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href="mailto:support@stilltodo.app">Support</a>
      </footer>
    </div>
  );
}
