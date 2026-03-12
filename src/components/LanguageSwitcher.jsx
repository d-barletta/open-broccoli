import { useTranslation } from 'react-i18next'
import { useState } from 'react'

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'it', flag: '🇮🇹', label: 'IT' },
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'de', flag: '🇩🇪', label: 'DE' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)

  const current = LANGUAGES.find(l => l.code === i18n.resolvedLanguage) || LANGUAGES[0]

  function select(code) {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border
          bg-gray-800/60 border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-600 transition-all"
      >
        <span>{current.flag}</span>
        <span className="font-medium">{current.label}</span>
        <svg className={`w-3 h-3 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 bg-gray-800 border border-gray-700/60 rounded-lg shadow-xl z-50 py-1 min-w-[90px]">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-700/60 transition-colors
                ${lang.code === i18n.resolvedLanguage ? 'text-yellow-300 font-semibold' : 'text-gray-300'}`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
