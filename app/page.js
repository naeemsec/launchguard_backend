export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '80px auto', padding: 24 }}>
      <h1>LaunchGuard Billing Service</h1>
      <p>This service receives verified Paddle webhooks and mirrors subscription entitlement state.</p>
      <p>No customer payment-card data is handled here.</p>
    </main>
  );
}
