import Link from "next/link";
export default function Privacy() {
  return (
    <main className="legal">
      <Link className="brand" href="/">
        still.
      </Link>
      <h1>Privacy, with a little clarity.</h1>
      <div className="notice">
        Starter policy — the operator must add their contact details, retention
        periods, and jurisdiction, and obtain legal review before public launch.
      </div>
      <h2>What Still stores</h2>
      <p>
        Your email and authentication records, tasks, notes, lists, regional
        preferences, and notification subscriptions. Authentication is managed
        by Supabase. Passwords are not stored by this application.
      </p>
      <h2>How your information is used</h2>
      <p>
        To provide your workspace, synchronize devices, and send the reminders
        you choose. This application includes no third-party advertising or
        analytics trackers. The hosting and database providers process service
        data under the operator’s agreements.
      </p>
      <h2>Data on your device</h2>
      <p>
        Still stores your login session and account-scoped offline data on this
        browser. Signing out clears the local task snapshot and queue. Avoid
        shared browser profiles for private tasks. Browser storage clearing can
        remove unsynchronized changes.
      </p>
      <h2>Reminders</h2>
      <p>
        Push subscriptions are sent to the server only when you enable
        notifications. Push messages use generic text so task titles are not
        exposed on your lock screen. Your browser’s push provider processes
        delivery metadata.
      </p>
      <h2>Deletion and retention</h2>
      <p>
        Account deletion removes associated application records from the live
        database. Deleted tasks are retained as synchronization tombstones until
        account deletion. Backups and infrastructure logs follow the operator’s
        configured retention policy. The operator must publish those periods and
        a privacy contact here before launch.
      </p>
      <h2>Your choices</h2>
      <p>
        You can change preferences, disable this device’s notifications, or
        delete your account in Settings. Contact the operator for access,
        export, correction, or jurisdiction-specific requests.
      </p>
    </main>
  );
}
