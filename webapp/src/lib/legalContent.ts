// Legal copy for /terms, /privacy, /waiver and the acceptance gate (Phase 5).
//
// These are PLAIN-LANGUAGE summaries to build the acceptance infrastructure now.
// The full legal language will be supplied separately and can replace `sections`
// without touching the acceptance flow or versions (see lib/waivers.ts).

import type { LegalDocument } from "./types";

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalContent {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_CONTENT: Record<LegalDocument, LegalContent> = {
  terms: {
    title: "Terms of Service",
    intro:
      "These terms govern your use of YardLine. By using the platform you agree to them. This is a plain-language summary; the full legal terms will be provided separately.",
    sections: [
      {
        heading: "YardLine is a marketplace",
        body: "YardLine connects students with independent providers and event hosts. We provide the platform; we do not deliver the services or run the events ourselves.",
      },
      {
        heading: "Your account",
        body: "Keep your login secure and your information accurate. You're responsible for activity on your account. You must be a member of your campus community to participate.",
      },
      {
        heading: "Bookings, tickets & payments",
        body: "Payments are processed by our payment partner. Providers set their own prices and availability; hosts set their own ticket prices and refund policies. Platform fees are shown before you pay.",
      },
      {
        heading: "Acceptable use",
        body: "No fraud, harassment, spam, or illegal activity. Content or behavior that violates these terms may be removed and accounts may be suspended.",
      },
      {
        heading: "Changes",
        body: "We may update these terms. When the terms materially change, you'll be asked to accept the new version before continuing with paid or provider actions.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro:
      "This explains what we collect and how we use it. This is a plain-language summary; the full privacy policy will be provided separately.",
    sections: [
      {
        heading: "What we collect",
        body: "Account details (name, email, campus), the content you create (listings, events, messages, reviews), and transaction records needed to operate bookings and tickets.",
      },
      {
        heading: "How we use it",
        body: "To run the marketplace: show your listings, deliver messages and notifications, process payments, prevent abuse, and provide support.",
      },
      {
        heading: "Sharing",
        body: "We share information with the other party in a booking or conversation, and with service providers like our payment processor. We don't sell your personal data.",
      },
      {
        heading: "Your choices",
        body: "You can update your profile, manage notifications, and request help with your data at any time.",
      },
    ],
  },
  waiver: {
    title: "Liability Waiver",
    intro:
      "Please read this carefully before becoming a provider, booking a service, hosting a paid event, or buying a ticket.",
    sections: [
      {
        heading: "YardLine is a marketplace",
        body: "YardLine simply connects students. We are not a party to the agreements between providers, hosts, and customers.",
      },
      {
        heading: "Providers operate independently",
        body: "Providers and hosts are independent and are solely responsible for the services they offer and the events they run.",
      },
      {
        heading: "No guarantee of qualifications",
        body: "YardLine does not verify, endorse, or guarantee the qualifications, licensing, or quality of any provider or host.",
      },
      {
        heading: "Participation is at your own risk",
        body: "You participate in services and events at your own risk. To the fullest extent permitted by law, YardLine is not liable for injuries, losses, or damages arising from your use of the platform.",
      },
    ],
  },
};
