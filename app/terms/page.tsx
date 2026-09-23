import Link from "next/link";
export default function Terms() {
  return (
    <main className="legal">
      <Link className="brand" href="/">
        still.
      </Link>
      <h1>A few things to agree on.</h1>
      <div className="notice">
        Starter terms — add the operator’s legal identity, contact information,
        jurisdiction, age requirements, and dispute terms. Legal review is
        required before public launch.
      </div>
      <h2>Your account</h2>
      <p>
        Keep your credentials private and use accurate account information. Do
        not use the service to access other people’s data, disrupt service,
        distribute malicious content, or violate applicable law.
      </p>
      <h2>Your content</h2>
      <p>
        You retain rights to your tasks and notes. You authorize the operator
        and infrastructure providers to process them only as needed to operate
        the service and meet legal obligations.
      </p>
      <h2>Reminders and availability</h2>
      <p>
        Notifications depend on your device, permissions, connectivity, and
        server availability. Delivery timing is not guaranteed. Do not use this
        service as the sole reminder system for emergencies or other
        safety-critical obligations.
      </p>
      <h2>Ending use</h2>
      <p>
        You may delete your account in Settings. The operator must describe
        suspension, termination, liability, and any paid service terms here
        before launch.
      </p>
      <h2>Open-source software</h2>
      <p>
        The application source is provided under the MIT License. These service
        terms are separate from that software license.
      </p>
    </main>
  );
}
