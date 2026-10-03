import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Still collects, uses, stores, and protects personal information.",
};

const SUPPORT_EMAIL = "support@stilltodo.app";

export default function Privacy() {
  return (
    <main className="legal">
      <Link className="brand" href="/">
        still.
      </Link>
      <h1>Privacy, with a little clarity.</h1>
      <p>
        <strong>Effective October 3, 2026.</strong> This Privacy Policy explains
        how Still, operated by Dhruv Patel in Ontario, Canada, handles personal
        information when you use stilltodo.app and the Still application.
      </p>

      <h2>What Still collects</h2>
      <p>
        Still collects the information needed to provide the service. This may
        include your email address and authentication identifiers; tasks, notes,
        lists, dates, reminders, and preferences you create; timezone, locale,
        and appearance settings; push-notification subscription information;
        and limited technical or security information generated when the service
        is used. Still does not store your password itself. Authentication is
        handled by Supabase.
      </p>

      <h2>How your information is used</h2>
      <p>
        Your information is used to create and secure your account, provide and
        synchronize your workspace across devices, support offline changes, send
        reminders and account emails you request, respond to support messages,
        prevent abuse, troubleshoot problems, and comply with applicable legal
        obligations. Still does not sell your personal information and does not
        include third-party advertising or advertising analytics trackers.
      </p>

      <h2>Service providers</h2>
      <p>
        Still relies on service providers to operate the application. These
        include Supabase for authentication and database services, Vercel for
        application hosting and scheduled jobs, Resend for authentication email,
        ImprovMX for forwarding support email, and browser or operating-system
        push services when you enable notifications. These providers process
        information only as needed to provide their services to Still and may
        process or store information outside Ontario or Canada, where it may be
        subject to the laws of those jurisdictions.
      </p>

      <h2>Data stored on your device</h2>
      <p>
        Still stores your authenticated session and account-scoped offline data
        in your browser or installed app so the service can work across reloads
        and temporary loss of connectivity. Signing out clears the local task
        snapshot and pending queue for that account. Clearing browser or app
        storage can remove unsynchronized changes. Still uses necessary browser
        storage for these functions and does not use it for advertising.
      </p>

      <h2>Reminders and notifications</h2>
      <p>
        Push-notification subscription information is sent to Still only after
        you enable notifications. Reminder notifications use generic text so
        task titles are not intentionally exposed on your lock screen. Your
        browser, device manufacturer, or push provider may process delivery
        metadata. You can disable notifications at any time in Still or in your
        device settings.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Account information and task data are retained while your account is
        active and as needed to provide the service. Deleted tasks may remain as
        synchronization tombstones until the account is deleted. When you use
        the account-deletion control in Settings, Still removes the account and
        associated application records from the active database. Limited data
        may remain temporarily in provider backups, security logs, or support
        records according to provider retention practices or where retention is
        reasonably necessary for security, legal, or fraud-prevention purposes.
      </p>

      <h2>Your choices and privacy rights</h2>
      <p>
        You can update preferences, disable notifications, and permanently
        delete your account from Settings. You may also contact Still to request
        access to, correction of, or deletion of personal information, or to
        withdraw consent where applicable. Some information may need to be
        retained where required by law or necessary for legitimate security and
        record-keeping purposes.
      </p>

      <h2>Children and teens</h2>
      <p>
        Still is a general-purpose productivity service intended for people age
        13 and older. Still does not knowingly collect personal information from
        children under 13. If you believe a child under 13 has created an
        account, contact Still so the account and associated information can be
        reviewed and deleted as appropriate.
      </p>

      <h2>Security</h2>
      <p>
        Still uses reasonable technical and organizational safeguards designed
        to protect account data, including authenticated access and database
        access controls. No online service can guarantee absolute security, so
        you should use a unique password and keep your devices and account
        credentials secure.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        This policy may be updated as Still changes. Material changes will be
        reflected by updating the effective date and, where appropriate, by
        providing additional notice in the service.
      </p>

      <h2>Contact</h2>
      <p>
        Still is operated by Dhruv Patel in Ontario, Canada. For privacy,
        account, or support questions, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </main>
  );
}
