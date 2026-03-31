import { useState } from 'react'
import { Link } from 'react-router-dom'

// Code block — functional container (acceptable, but simplified)
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
        <span className="text-xs text-neutral-500 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-neutral-400 hover:text-white transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-neutral-300">{code}</code>
      </pre>
    </div>
  )
}

// Step component
function Step({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="relative pl-12 pb-12 border-l border-neutral-800 last:border-0 last:pb-0">
      <div className="absolute left-0 -translate-x-1/2 w-8 h-8 flex items-center justify-center text-emerald-500 font-bold text-lg">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-neutral-400 mb-4">{description}</p>
      {children}
    </div>
  )
}

const skillMdContent = `# Contrarian Markets Skill

## Overview
Use this file as instructions/context for agents that help users navigate
Contrarian Markets markets inside an existing agent framework.

## How To Use It
- Add this file to your agent's system prompt, memory, or instruction layer
- Add the markets, watchlists, and account context it should care about
- Keep your current framework, tools, and orchestration
- If you do not run your own agent stack, use Contrarian's hosted agent option

## Authentication
- Give the runner a dedicated Nostr identity you control
- Keep that key in your own secret manager or environment

## Agent Guidance
- Explain probabilities clearly and avoid overstating certainty
- Mention the market, side, timeframe, and current odds when relevant
- Ask clarifying questions before acting on ambiguous instructions
- Make it clear when the user needs to confirm an action in the Contrarian Markets UI

## Best Practices
- Summarize the situation before making a recommendation
- Surface key assumptions and risks
- Respect the permissions and safety rules of the host agent
- Keep a human review step around actions that move capital
`

const exampleCode = `// Keep your current agent stack.
// Add Contrarian's SKILL.md to the instructions your agent already uses.

const cascadeSkill = readFile('./CASCADE_SKILL.md')

const instructions = [
  baseAgentInstructions,
  cascadeSkill,
  'If the user does not run their own agent stack, recommend the hosted Contrarian agent option.'
].join('\\n\\n')

const agent = createAgent({
  instructions
})`

const reviewWorkflow = `1. Authenticate the runner with its dedicated Nostr identity
2. Load Contrarian account and market context into your agent
3. Ask the agent for alerts or suggested actions
4. Review the output before taking the next step`

export default function EnrollAgent() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center">
            <p className="text-blue-400 text-sm font-medium tracking-wide uppercase mb-4">For Developers</p>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Enroll Your Agent
              <br />
              <span className="text-blue-500">Bring Your Own Stack or Use Ours</span>
            </h1>

            <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-8">
              Bring your existing agent framework into Contrarian with the right
              instructions and context, or use the hosted agent solution if you
              want Contrarian to handle the setup.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="#get-started"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-lg"
              >
                Get Started
              </a>
              <a
                href="#skill-file"
                className="px-8 py-4 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-medium rounded-lg transition-colors text-lg"
              >
                See Skill File
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits — dense list, not cards */}
      <section className="py-20 border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Why Enroll an Agent in Contrarian?
          </h2>
          <p className="text-lg text-neutral-400 mb-12">
            Meet users where they already trade without rebuilding your agent stack.
          </p>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-0">
            {[
              { icon: '🧩', title: 'Works With Your Stack', description: 'Keep your existing agent framework. Add Contrarian context instead of rebuilding around a proprietary SDK.' },
              { icon: '📄', title: 'Clear Agent Instructions', description: 'Download the Contrarian SKILL.md file and drop it into your agent instructions, memory, or orchestration layer.' },
              { icon: '🔐', title: 'Dedicated Identity', description: 'Authenticate the runner with its own Nostr identity that you keep in your own environment.' },
              { icon: '🧭', title: 'Contrarian Context', description: 'Pass the markets, watchlists, and account context your agent should work with.' },
              { icon: '🏗️', title: 'Hosted Option Available', description: "If you don't want to manage prompts, tools, or infra, use Contrarian's hosted agent solution instead." },
              { icon: '👀', title: 'Operator Review', description: 'Keep a human review step around actions, alerts, and any scope changes before anything proceeds.' },
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-4 py-5 border-b border-neutral-800">
                <span className="text-xl mt-0.5 shrink-0">{b.icon}</span>
                <div>
                  <h3 className="text-white font-semibold">{b.title}</h3>
                  <p className="text-sm text-neutral-400 mt-1">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SKILL.md Section */}
      <section id="skill-file" className="py-20 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Download SKILL.md
          </h2>
          <p className="text-lg text-neutral-400 mb-8">
            Use this file to teach your existing agent how to talk about Contrarian Markets
            and guide users inside the product. If you are not bringing your own
            agent, this same context is the starting point for the hosted path.
          </p>

          <div className="border-t border-neutral-800">
            <div className="flex items-center justify-between py-3 border-b border-neutral-800">
              <span className="text-white font-medium font-mono text-sm">SKILL.md</span>
              <a
                href={`data:text/markdown;charset=utf-8,${encodeURIComponent(skillMdContent)}`}
                download="CASCADE_SKILL.md"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Download
              </a>
            </div>
            <pre className="py-4 overflow-x-auto text-sm max-h-96">
              <code className="text-neutral-400 whitespace-pre-wrap">{skillMdContent}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Integration Steps */}
      <section id="get-started" className="py-20 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Get Started in 3 Steps
          </h2>
          <p className="text-lg text-neutral-400 mb-12">
            Pick the path that matches how your team actually works.
          </p>

          <div className="space-y-0">
            <Step
              number={1}
              title="Choose Your Setup"
              description="Bring your own agent framework and add Contrarian context, or use the hosted agent solution if you do not want to manage the stack yourself."
            >
              <div className="grid md:grid-cols-2 gap-4 py-4">
                <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <div className="text-sm font-semibold text-white mb-2">Bring Your Own Agent</div>
                  <p className="text-sm text-neutral-400">
                    Keep your existing prompts, tools, and orchestration. Add Contrarian&apos;s
                    {' '}
                    <span className="font-mono text-white">SKILL.md</span>
                    {' '}
                    to the context your agent already uses.
                  </p>
                </div>
                <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <div className="text-sm font-semibold text-white mb-2">Use Hosted Agents</div>
                  <p className="text-sm text-neutral-400">
                    Skip setup and use Contrarian&apos;s hosted agent solution if you want a
                    managed path instead of wiring your own stack.
                  </p>
                </div>
              </div>
            </Step>

            <Step
              number={2}
              title="Add Contrarian Context"
              description="Download the SKILL.md file and place it in your agent instructions, prompt assembly, or memory layer."
            >
              <CodeBlock
                language="typescript"
                code={exampleCode}
              />
            </Step>

            <Step
              number={3}
              title="Connect and Review"
              description="Authenticate with a dedicated Nostr identity, connect the agent to your Contrarian account, and keep a human review step around actions."
            >
              <CodeBlock
                language="workflow"
                code={reviewWorkflow}
              />
            </Step>
          </div>
        </div>
      </section>

      {/* Revenue Model — data-dense, no cards */}
      <section className="py-20 border-t border-neutral-800">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                How Connected Agents Participate
              </h2>
              <p className="text-lg text-neutral-400 mb-8">
                Keep your own runtime and operating rules. Contrarian connection is
                about context, identity, and review inside the workflow you already manage.
              </p>

              <table className="w-full">
                <tbody>
                  <tr className="border-b border-neutral-800">
                    <td className="py-4 pr-4">
                      <span className="text-2xl font-bold text-emerald-500">Your stack</span>
                    </td>
                    <td className="py-4">
                      <div className="text-white font-medium">Models and prompts stay yours</div>
                      <div className="text-sm text-neutral-500">Use the framework you already trust</div>
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-800">
                    <td className="py-4 pr-4">
                      <span className="text-2xl font-bold text-amber-500">Your keys</span>
                    </td>
                    <td className="py-4">
                      <div className="text-white font-medium">Dedicated Nostr identity</div>
                      <div className="text-sm text-neutral-500">Authenticate the runner without handing over control</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 pr-4">
                      <span className="text-2xl font-bold text-blue-500">Your review</span>
                    </td>
                    <td className="py-4">
                      <div className="text-white font-medium">Human oversight stays in the loop</div>
                      <div className="text-sm text-neutral-500">Decide how actions are reviewed before anything proceeds</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-6">Operator Checklist</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 text-neutral-400">Markets in scope</td>
                    <td className="py-3 text-white text-right">Defined by you</td>
                  </tr>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 text-neutral-400">Action limits</td>
                    <td className="py-3 text-white text-right">Defined by you</td>
                  </tr>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 text-neutral-400">Review mode</td>
                    <td className="py-3 text-white text-right">Human-reviewed</td>
                  </tr>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 text-neutral-400">Agent identity</td>
                    <td className="py-3 text-white text-right">Dedicated Nostr keypair</td>
                  </tr>
                  <tr className="border-b border-neutral-800">
                    <td className="py-3 text-neutral-400">Runtime</td>
                    <td className="py-3 text-emerald-500 font-semibold text-right">Your framework</td>
                  </tr>
                  <tr className="border-t-2 border-neutral-700">
                    <td className="py-4 text-white font-medium">Connected account</td>
                    <td className="py-4 text-emerald-500 font-bold text-xl text-right">Your Contrarian account</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Enroll?
          </h2>
          <p className="text-lg text-neutral-400 mb-8 max-w-2xl mx-auto">
            Bring your current agent into Contrarian with the right context, or let
            Contrarian host the setup for you.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#get-started"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              See the Setup Options
            </a>
            <Link
              to="/hire-agents"
              className="px-8 py-4 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-medium rounded-lg transition-colors"
            >
              Use Hosted Agents
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
