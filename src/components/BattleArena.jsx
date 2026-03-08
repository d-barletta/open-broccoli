import { useState, useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'
import ModelSelector from './ModelSelector'
import { streamChatCompletion } from '../services/openrouter'

const CHALLENGER_SYSTEM = `You are a knowledgeable assistant providing comprehensive and accurate answers. Give detailed, well-structured responses that thoroughly address the question.`

const CRITIC_SYSTEM = `You are a critical analyst. Your task is to identify weaknesses, logical flaws, factual errors, and missing information in the following AI response. Be specific and constructive. Structure your critique with clear sections: 1) Main Issues, 2) Factual Concerns, 3) Missing Context, 4) What Was Done Well. Keep your analysis sharp and actionable.`

const DEFAULT_MODEL_A = 'openai/gpt-4o-mini'
const DEFAULT_MODEL_B = 'anthropic/claude-3-haiku'

const PHASES = {
  IDLE: 'idle',
  CHALLENGER: 'challenger',
  CRITIC: 'critic',
  DONE: 'done',
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function StatusBadge({ phase, side }) {
  const isBlue = side === 'left'

  const states = {
    idle: { label: 'Ready', color: isBlue ? 'bg-blue-900/40 text-blue-400 border-blue-500/30' : 'bg-red-900/40 text-red-400 border-red-500/30' },
    active: { label: 'Generating…', color: isBlue ? 'bg-blue-500/20 text-blue-300 border-blue-400/50 animate-pulse' : 'bg-red-500/20 text-red-300 border-red-400/50 animate-pulse' },
    done: { label: 'Done ✓', color: isBlue ? 'bg-green-900/40 text-green-400 border-green-500/30' : 'bg-green-900/40 text-green-400 border-green-500/30' },
    waiting: { label: 'Waiting…', color: 'bg-gray-800 text-gray-500 border-gray-700' },
  }

  const state = states[phase] || states.idle

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${state.color}`}>
      {state.label}
    </span>
  )
}

export default function BattleArena({ apiKey, models, modelsLoading }) {
  const [modelA, setModelA] = useState(DEFAULT_MODEL_A)
  const [modelB, setModelB] = useState(DEFAULT_MODEL_B)
  const [question, setQuestion] = useState('')
  const [challengerContent, setChallengerContent] = useState('')
  const [criticContent, setCriticContent] = useState('')
  const [phase, setPhase] = useState(PHASES.IDLE)
  const [error, setError] = useState(null)
  const [rounds, setRounds] = useState(0)

  const challengerRef = useRef(null)
  const criticRef = useRef(null)

  const isRunning = phase === PHASES.CHALLENGER || phase === PHASES.CRITIC

  const scrollToBottom = (ref) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }

  async function startBattle() {
    if (!question.trim() || isRunning) return
    setError(null)
    setChallengerContent('')
    setCriticContent('')
    const currentQuestion = question.trim()

    setPhase(PHASES.CHALLENGER)
    let challengerFull = ''

    await streamChatCompletion({
      apiKey,
      model: modelA,
      messages: [
        { role: 'system', content: CHALLENGER_SYSTEM },
        { role: 'user', content: currentQuestion },
      ],
      onChunk: (delta, full) => {
        challengerFull = full
        setChallengerContent(full)
        scrollToBottom(challengerRef)
      },
      onDone: (full) => {
        challengerFull = full
      },
      onError: (err) => {
        setError(`Challenger error: ${err.message}`)
        setPhase(PHASES.IDLE)
      },
    })

    if (!challengerFull) return

    setPhase(PHASES.CRITIC)

    await streamChatCompletion({
      apiKey,
      model: modelB,
      messages: [
        { role: 'system', content: CRITIC_SYSTEM },
        {
          role: 'user',
          content: `Original question: "${currentQuestion}"\n\nAI Response to critique:\n\n${challengerFull}`,
        },
      ],
      onChunk: (delta, full) => {
        setCriticContent(full)
        scrollToBottom(criticRef)
      },
      onDone: (full) => {
        setPhase(PHASES.DONE)
        setRounds(r => r + 1)
      },
      onError: (err) => {
        setError(`Critic error: ${err.message}`)
        setPhase(PHASES.DONE)
      },
    })
  }

  const challengerStatus = phase === PHASES.CHALLENGER ? 'active' : (challengerContent ? 'done' : 'idle')
  const criticStatus = phase === PHASES.CRITIC ? 'active' : phase === PHASES.CHALLENGER ? 'waiting' : (criticContent ? 'done' : 'idle')

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto px-4 pb-8">

      {/* Header */}
      <div className="text-center pt-8 pb-2">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="text-4xl">⚔️</span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-yellow-300 to-red-400 bg-clip-text text-transparent">
            LLM Battle Arena
          </h1>
          <span className="text-4xl">⚔️</span>
        </div>
        <p className="text-gray-400 text-sm max-w-xl mx-auto">
          One model answers. The other critiques. Who will emerge victorious?
        </p>
        {rounds > 0 && (
          <div className="mt-2 inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1">
            <span className="text-yellow-400 text-sm font-bold">Round {rounds} Complete</span>
          </div>
        )}
      </div>

      {/* Model Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div className="battle-panel-blue glow-blue rounded-xl p-4">
          <ModelSelector
            label="⚔️ Challenger (Model A)"
            value={modelA}
            onChange={setModelA}
            models={models}
            loading={modelsLoading}
            side="left"
          />
        </div>

        <div className="hidden md:flex items-center justify-center">
          <span className="text-3xl font-black text-yellow-400 vs-glow">VS</span>
        </div>

        <div className="battle-panel-red glow-red rounded-xl p-4">
          <ModelSelector
            label="🔍 Critic (Model B)"
            value={modelB}
            onChange={setModelB}
            models={models}
            loading={modelsLoading}
            side="right"
          />
        </div>
      </div>

      {/* Question Input */}
      <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-4">
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
          Your Question
        </label>
        <div className="flex gap-3">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) startBattle()
            }}
            placeholder="Ask anything — the challenger will answer, the critic will strike…"
            rows={3}
            disabled={isRunning}
            className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-lg px-4 py-3 text-gray-100 
              placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-yellow-500/50 
              focus:ring-1 focus:ring-yellow-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={startBattle}
            disabled={!question.trim() || isRunning || !apiKey}
            className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 
              hover:to-orange-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500
              text-gray-900 font-bold rounded-lg transition-all duration-200 text-sm
              disabled:cursor-not-allowed active:scale-95 shadow-lg hover:shadow-orange-500/25"
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fighting…
              </span>
            ) : (
              '⚔️ Battle!'
            )}
          </button>
        </div>
        {!apiKey && (
          <p className="text-yellow-500/70 text-xs mt-2">⚠ Enter your OpenRouter API key to start battles</p>
        )}
        <p className="text-gray-600 text-xs mt-1">Tip: Ctrl+Enter to battle</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border border-red-500/40 rounded-lg px-4 py-3 text-red-300 text-sm flex items-start gap-2">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Battle Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Challenger Panel */}
        <div className="battle-panel-blue glow-blue rounded-xl overflow-hidden animate-slide-in-left">
          <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/20 bg-blue-950/30">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-lg">⚔️</span>
              <div>
                <div className="text-blue-300 font-bold text-sm">Challenger</div>
                <div className="text-blue-500/70 text-xs truncate max-w-[160px]">{modelA}</div>
              </div>
            </div>
            <StatusBadge phase={challengerStatus} side="left" />
          </div>

          <div
            ref={challengerRef}
            className="p-4 min-h-[200px] max-h-[500px] overflow-y-auto"
          >
            {phase === PHASES.CHALLENGER && !challengerContent && <LoadingDots />}
            {challengerContent ? (
              <ChatMessage
                content={challengerContent}
                isStreaming={phase === PHASES.CHALLENGER}
                side="left"
              />
            ) : phase === PHASES.IDLE ? (
              <div className="flex items-center justify-center h-full min-h-[180px] text-gray-600 text-sm">
                Awaiting your question…
              </div>
            ) : null}
          </div>
        </div>

        {/* Critic Panel */}
        <div className="battle-panel-red glow-red rounded-xl overflow-hidden animate-slide-in-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-500/20 bg-red-950/30">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-lg">🔍</span>
              <div>
                <div className="text-red-300 font-bold text-sm">Critic</div>
                <div className="text-red-500/70 text-xs truncate max-w-[160px]">{modelB}</div>
              </div>
            </div>
            <StatusBadge phase={criticStatus} side="right" />
          </div>

          <div
            ref={criticRef}
            className="p-4 min-h-[200px] max-h-[500px] overflow-y-auto"
          >
            {phase === PHASES.CRITIC && !criticContent && <LoadingDots />}
            {phase === PHASES.CHALLENGER && !criticContent && (
              <div className="flex items-center gap-2 text-gray-600 text-sm mt-2">
                <svg className="animate-spin w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Waiting for challenger to finish…
              </div>
            )}
            {criticContent ? (
              <ChatMessage
                content={criticContent}
                isStreaming={phase === PHASES.CRITIC}
                side="right"
              />
            ) : phase === PHASES.IDLE ? (
              <div className="flex items-center justify-center h-full min-h-[180px] text-gray-600 text-sm">
                Awaiting challenger's response…
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Battle Result Banner */}
      {phase === PHASES.DONE && challengerContent && criticContent && (
        <div className="bg-gradient-to-r from-blue-950/50 via-yellow-950/30 to-red-950/50 border border-yellow-500/30 
          rounded-xl p-4 text-center animate-bounce-in">
          <div className="text-yellow-400 font-black text-xl mb-1">⚡ Round {rounds} Complete!</div>
          <p className="text-gray-400 text-sm">
            The critic has spoken. Ask another question to continue the battle!
          </p>
        </div>
      )}
    </div>
  )
}
