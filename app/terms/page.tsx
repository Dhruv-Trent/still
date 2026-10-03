import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms that apply when you use Still.",
};

const SUPPORT_EMAIL = "support@stilltodo.app";

export default function Terms() {
  return (
    <main className="legal">
      <Link className="brand" href="/">
        still.
      </Link>
      <h1>A few things to agree on.</h1>
      <p>
        <strong>Effective October 3, 2026.</strong> These Terms of Service govern
        your use of stilltodo.app and the Still application, operated by Dhruv
        Patel in Ontario, Canada. By creating an account or using Still, you
        agree to these Terms and the Privacy Policy.
      </p>

      <h2>Who may use Still</h2>
      <p>
        You must be at least 13 years old to create or use a Still account. If
        you are under the age of majority where you live, you may use Still only
        if you can lawfully agree to these Terms and obtain permission from a
        parent or guardian where local law requires it.
      </p>

      <h2>Your account</h2>
      <p>
        Provide an email address you are authorized to use and keep your login
        credentials private. You are responsible for activity under your account
        unless it results from a security failure for which Still is legally
        responsible. Contact Still promptly if you believe your account has been
        compromised.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not use Still to access another person&apos;s account or data without
        permission, interfere with or overload the service, probe or bypass
        security controls, distribute malware or harmful code, send unlawful or
        abusive content, or use the service in a way that violates applicable
        law or the rights of others.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of the tasks, notes, lists, and other content you add
        to Still. You give Still and its infrastructure providers only the
        limited permission needed to host, process, synchronize, back up, and
        transmit that content so the service can operate and legal obligations
        can be met. Still does not claim ownership of your task content.
      </p>

      <h2>Reminders, offline use, and availability</h2>
      <p>
        Reminder delivery depends on device settings, browser or operating-system
        push services, network connectivity, and server availability. Offline
        changes also depend on local browser storage until they synchronize.
        Delivery and synchronization timing are not guaranteed. Do not rely on
        Still as the sole reminder or record-keeping system for emergencies,
        medical treatment, safety-critical duties, legal deadlines, or other
        situations where a missed reminder could cause serious harm.
      </p>

      <h2>Service changes and pricing</h2>
      <p>
        Still may add, remove, or change features to maintain or improve the
        service. The service is currently offered without a required usage fee.
        If paid features are introduced later, applicable pricing and any
        additional purchase terms will be presented before you choose to buy
        them.
      </p>

      <h2>Suspension and ending use</h2>
      <p>
        You may stop using Still at any time and can permanently delete your
        account in Settings. Still may restrict or suspend access where
        reasonably necessary to address abuse, security threats, legal
        requirements, or serious violations of these Terms. Where practical,
        Still will try to provide notice before an account is terminated for a
        non-urgent reason.
      </p>

      <h2>Disclaimers</h2>
      <p>
        Still is provided on an &quot;as available&quot; basis. To the extent permitted
        by law, no guarantee is made that the service will always be available,
        error-free, or suitable for every purpose. Nothing in these Terms limits
        any warranty, consumer right, or other protection that cannot lawfully be
        excluded.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by applicable law, Still and its operator will
        not be liable for indirect, incidental, special, consequential, or
        punitive damages arising from use of the service, including losses caused
        by missed reminders, interrupted access, or unsynchronized local changes.
        This limitation does not apply where liability cannot legally be limited
        or excluded.
      </p>

      <h2>Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of Ontario and the applicable laws
        of Canada, without regard to conflict-of-law rules. Before starting a
        formal dispute, please contact Still at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> so there is an
        opportunity to resolve the issue informally. Unless applicable consumer
        law gives you the right to proceed elsewhere, disputes may be brought in
        the courts of Ontario, Canada.
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        These Terms may be updated when the service or legal requirements
        change. Material changes will be reflected by updating the effective
        date and, where appropriate, by providing additional notice. Continuing
        to use Still after revised Terms take effect means the revised Terms
        apply to future use.
      </p>

      <h2>Open-source software</h2>
      <p>
        The Still application source is provided under the MIT License. That
        software license is separate from these Terms governing use of the
        hosted Still service.
      </p>

      <h2>Contact</h2>
      <p>
        Still is operated by Dhruv Patel in Ontario, Canada. Questions about
        these Terms or the service can be sent to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </main>
  );
}
