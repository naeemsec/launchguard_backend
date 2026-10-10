export const metadata = {
  title: 'LaunchGuard — Pre-Launch Website QA',
  description:
    'LaunchGuard is a Chrome extension for pre-launch website QA, staging and production comparison, regression checks, saved projects and professional reports.',

  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0
        }}
      >
        {children}
      </body>
    </html>
  );
}