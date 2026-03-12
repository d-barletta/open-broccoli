import LanguageSwitcher from './LanguageSwitcher'

export default function PageFooter() {
  return (
    <footer className="border-t border-gray-800/40 py-6 text-center text-xs text-gray-700">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <p>
          Made by woody ·{' '}
          <a
            href="https://github.com/d-barletta/open-broccoli"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-400 underline underline-offset-2"
          >
            GitHub
          </a>
        </p>
        <LanguageSwitcher />
      </div>
    </footer>
  )
}
