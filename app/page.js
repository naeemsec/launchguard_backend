const PRIVACY_URL =
  'https://doc-hosting.flycricket.io/launchguard-privacypolicy/d9000ff5-f45a-4c00-ac18-f2670f1b326a/privacy';

const TERMS_URL =
  'https://doc-hosting.flycricket.io/launchguard-termsconditions/1d372b4c-e66a-44f7-9f86-a7297d810d9f/terms';


export default function Home() {
  const styles = {
    page: {
      minHeight: '100vh',
      background:
        'linear-gradient(180deg, #f8fafc 0%, #ffffff 45%, #f8fafc 100%)',
      color: '#0f172a',
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },

    container: {
      width: 'min(1080px, calc(100% - 40px))',
      margin: '0 auto'
    },

    nav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
      padding: '24px 0',
      flexWrap: 'wrap'
    },

    brand: {
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: '-0.5px'
    },

    navRight: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    },

    navLink: {
      color: '#475569',
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 600
    },

    badge: {
      padding: '7px 12px',
      borderRadius: 999,
      background: '#ecfdf5',
      color: '#047857',
      fontSize: 13,
      fontWeight: 700,
      border: '1px solid #a7f3d0'
    },

    hero: {
      padding: '80px 0 64px',
      textAlign: 'center'
    },

    eyebrow: {
      display: 'inline-block',
      marginBottom: 18,
      padding: '7px 12px',
      borderRadius: 999,
      background: '#eef2ff',
      color: '#4338ca',
      fontSize: 13,
      fontWeight: 700
    },

    title: {
      maxWidth: 800,
      margin: '0 auto',
      fontSize: 'clamp(40px, 7vw, 70px)',
      lineHeight: 1.02,
      letterSpacing: '-2.5px'
    },

    lead: {
      maxWidth: 700,
      margin: '24px auto 0',
      fontSize: 18,
      lineHeight: 1.7,
      color: '#475569'
    },

    section: {
      padding: '36px 0'
    },

    sectionTitle: {
      margin: '0 0 12px',
      fontSize: 30,
      letterSpacing: '-1px'
    },

    sectionText: {
      margin: 0,
      color: '#64748b',
      lineHeight: 1.7
    },

    grid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 16,
      marginTop: 26
    },

    card: {
      padding: 24,
      border: '1px solid #e2e8f0',
      borderRadius: 18,
      background: '#ffffff',
      boxShadow:
        '0 12px 35px rgba(15, 23, 42, 0.05)'
    },

    cardTitle: {
      margin: '0 0 8px',
      fontSize: 18
    },

    cardText: {
      margin: 0,
      color: '#64748b',
      lineHeight: 1.6
    },

    pricingWrap: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 18,
      marginTop: 28
    },

    priceCard: {
      padding: 28,
      border: '1px solid #dbeafe',
      borderRadius: 20,
      background: '#ffffff'
    },

    priceName: {
      margin: 0,
      fontSize: 18,
      fontWeight: 700
    },

    price: {
      margin: '14px 0 6px',
      fontSize: 38,
      fontWeight: 800,
      letterSpacing: '-1px'
    },

    priceMeta: {
      margin: 0,
      color: '#64748b'
    },

    legalBox: {
      marginTop: 28,
      padding: 26,
      borderRadius: 18,
      background: '#0f172a',
      color: '#ffffff'
    },

    legalText: {
      margin: '10px 0 0',
      lineHeight: 1.7,
      color: '#cbd5e1'
    },

    support: {
      display: 'inline-block',
      marginTop: 14,
      color: '#93c5fd',
      textDecoration: 'none',
      fontWeight: 700
    },

    legalLinks: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      marginTop: 24
    },

    legalLink: {
      display: 'inline-block',
      padding: '11px 15px',
      borderRadius: 10,
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      color: '#0f172a',
      textDecoration: 'none',
      fontWeight: 700,
      fontSize: 14
    },

    footer: {
      marginTop: 50,
      padding: '30px 0 40px',
      borderTop: '1px solid #e2e8f0',
      color: '#64748b',
      fontSize: 14,
      lineHeight: 1.7
    },

    footerLinks: {
      display: 'flex',
      gap: 14,
      flexWrap: 'wrap',
      marginTop: 12,
      marginBottom: 12
    },

    footerLink: {
      color: '#2563eb',
      textDecoration: 'none',
      fontWeight: 600
    }
  };


  return (
    <main style={styles.page}>
      <div style={styles.container}>

        <nav style={styles.nav}>
          <div style={styles.brand}>
            LaunchGuard
          </div>

          <div style={styles.navRight}>
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.navLink}
            >
              Privacy
            </a>

            <a
              href={TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.navLink}
            >
              Terms
            </a>

            <div style={styles.badge}>
              Website QA for Chrome
            </div>
          </div>
        </nav>


        <section style={styles.hero}>
          <div style={styles.eyebrow}>
            LaunchGuard Pro
          </div>

          <h1 style={styles.title}>
            Catch website launch issues before your users do.
          </h1>

          <p style={styles.lead}>
            LaunchGuard is a Chrome extension for pre-launch website
            quality assurance. It helps developers, freelancers and
            agencies scan websites, compare staging with production,
            detect regressions and generate professional QA reports.
          </p>
        </section>


        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            What LaunchGuard does
          </h2>

          <p style={styles.sectionText}>
            LaunchGuard combines everyday pre-launch checks with a
            local-first workflow designed for website QA.
          </p>

          <div style={styles.grid}>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                Website QA
              </h3>

              <p style={styles.cardText}>
                Check common SEO, accessibility, content, forms,
                resources, technical and launch-readiness issues.
              </p>
            </div>


            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                Staging vs Production
              </h3>

              <p style={styles.cardText}>
                Compare staging and live pages to help detect changes
                before or after deployment.
              </p>
            </div>


            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                Visual Comparison
              </h3>

              <p style={styles.cardText}>
                Capture and compare visible website views for visual
                regression checks.
              </p>
            </div>


            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                Projects & History
              </h3>

              <p style={styles.cardText}>
                Save projects, scans and comparisons locally in your
                browser for a repeatable QA workflow.
              </p>
            </div>


            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                Custom QA Rules
              </h3>

              <p style={styles.cardText}>
                Add safe custom checks for the requirements that matter
                to your own websites and clients.
              </p>
            </div>


            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                Professional Reports
              </h3>

              <p style={styles.cardText}>
                Generate QA reports and optionally apply your own
                company or client branding.
              </p>
            </div>

          </div>
        </section>


        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            LaunchGuard Pro pricing
          </h2>

          <p style={styles.sectionText}>
            LaunchGuard includes useful Free functionality. Pro unlocks
            the complete workflow for users who need deeper website QA.
          </p>

          <div style={styles.pricingWrap}>

            <div style={styles.priceCard}>
              <p style={styles.priceName}>
                Monthly
              </p>

              <div style={styles.price}>
                $12.99
              </div>

              <p style={styles.priceMeta}>
                USD per month
              </p>
            </div>


            <div style={styles.priceCard}>
              <p style={styles.priceName}>
                Annual
              </p>

              <div style={styles.price}>
                $99
              </div>

              <p style={styles.priceMeta}>
                USD per year
              </p>
            </div>

          </div>

          <p
            style={{
              ...styles.sectionText,
              marginTop: 18
            }}
          >
            Final currency, applicable taxes and billing details are
            shown before payment. Payments and subscription management
            are processed securely by Paddle.
          </p>
        </section>


        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Billing & cancellations
          </h2>

          <p style={styles.sectionText}>
            LaunchGuard Pro subscriptions renew according to the billing
            interval selected at checkout unless cancelled. Subscribers
            can manage billing, invoices, payment methods and
            cancellation through Paddle&apos;s secure Customer Portal.
          </p>

          <div style={styles.legalBox}>
            <h3
              style={{
                margin: 0,
                fontSize: 20
              }}
            >
              Refund policy
            </h3>

            <p style={styles.legalText}>
              Cancelling a subscription stops future renewal according
              to the applicable billing terms but does not automatically
              refund previous charges. Refund requests may be considered
              for duplicate or incorrect charges, appropriate billing or
              service issues, or where required by applicable law or
              Paddle&apos;s applicable buyer terms.
            </p>

            <p style={styles.legalText}>
              For billing, refund or product support, contact:
            </p>

            <a
              href="mailto:bilujee512@gmail.com?subject=LaunchGuard%20Support"
              style={styles.support}
            >
              bilujee512@gmail.com
            </a>
          </div>
        </section>


        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Privacy & legal
          </h2>

          <p style={styles.sectionText}>
            LaunchGuard is designed as a local-first QA tool. Ordinary
            website scans, saved projects, screenshots and QA results
            are kept in the user&apos;s browser rather than uploaded to
            the LaunchGuard billing backend.
          </p>

          <p
            style={{
              ...styles.sectionText,
              marginTop: 12
            }}
          >
            Limited subscription information is processed through
            LaunchGuard&apos;s backend and Paddle to provide Pro
            activation, subscription management and Restore Pro.
          </p>

          <div style={styles.legalLinks}>

            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.legalLink}
            >
              Privacy Policy
            </a>

            <a
              href={TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.legalLink}
            >
              Terms & Conditions
            </a>

          </div>
        </section>


        <footer style={styles.footer}>
          <strong>
            LaunchGuard
          </strong>

          <br />

          Independent website QA software for Chrome.

          <div style={styles.footerLinks}>
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.footerLink}
            >
              Privacy Policy
            </a>

            <a
              href={TERMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.footerLink}
            >
              Terms & Conditions
            </a>

            <a
              href="mailto:bilujee512@gmail.com?subject=LaunchGuard%20Support"
              style={styles.footerLink}
            >
              Support
            </a>
          </div>

          Payments processed securely by Paddle.

          <br />

          Support: bilujee512@gmail.com

          <br /><br />

          © 2026 LaunchGuard. All rights reserved.
        </footer>

      </div>
    </main>
  );
}