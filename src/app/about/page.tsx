export default function AboutPage() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'
  const sha = process.env.NEXT_PUBLIC_GIT_SHA

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">About</h1>

      <p className="text-gray-700 dark:text-gray-300 mb-8">
        <strong>Reporting</strong> helps Pexip administrators browse and export call reports from{' '}
        <strong>Pexip Infinity</strong>.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">What you can do</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
          <li>View call history and basic call details</li>
          <li>Filter and search to find specific calls</li>
          <li>Export report data for offline analysis and sharing</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Data source</h2>
        <p className="text-gray-700 dark:text-gray-300">
          Report data is retrieved from <strong>Pexip Infinity</strong> via its APIs. The available
          fields and history depend on your Infinity configuration and retention.
        </p>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-700 pt-6 text-sm text-gray-500 dark:text-gray-400 space-y-1">
        <p>Author: <span className="font-medium">@odallokken</span></p>
        <p>
          Version: <span className="font-medium">{version}</span>
          {sha && (
            <> &nbsp;·&nbsp; Commit: <span className="font-mono">{sha}</span></>
          )}
        </p>
      </footer>
    </div>
  )
}
