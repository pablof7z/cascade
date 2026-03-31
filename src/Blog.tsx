type BlogPost = {
  id: string
  title: string
  excerpt: string
  date: string
  readTime: string
  substackUrl: string
}

const posts: BlogPost[] = [
  {
    id: '1',
    title: 'Why Prediction Markets Need Infinite Games',
    excerpt: 'Traditional prediction markets close when an event happens. But the most important questions — AGI timelines, climate trajectories, geopolitical shifts — never truly resolve. They evolve. Contrarian Markets is built for these infinite games.',
    date: 'Mar 2026',
    readTime: '8 min read',
    substackUrl: 'https://pablof7z.substack.com',
  },
  {
    id: '2',
    title: 'Modular Theses: Stacking Predictions',
    excerpt: 'Your thesis on AI displacing knowledge work depends on AGI timing, regulatory capture, and labor market dynamics. Why trade them separately? Contrarian lets you compose predictions into coherent worldviews.',
    date: 'Mar 2026',
    readTime: '6 min read',
    substackUrl: 'https://pablof7z.substack.com',
  },
  {
    id: '3',
    title: 'Building on Nostr: Censorship-Resistant Markets',
    excerpt: 'Prediction markets are speech. They aggregate beliefs into prices. That makes them targets. By building on Nostr, Contrarian ensures no single entity can shut down the conversation.',
    date: 'Feb 2026',
    readTime: '5 min read',
    substackUrl: 'https://pablof7z.substack.com',
  },
]

export default function Blog() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Blog
        </h1>
        <p className="text-lg text-neutral-400 max-w-2xl">
          Ideas on prediction markets, infinite games, and building the future of conviction trading.
        </p>
      </section>

      {/* Subscribe CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Subscribe for updates
            </h2>
            <p className="text-sm text-neutral-400">
              Get new posts delivered to your inbox. No spam, just ideas.
            </p>
          </div>
          <a
            href="https://pablof7z.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-400 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
            </svg>
            Subscribe on Substack
          </a>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="space-y-6">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.substackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <article className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 hover:bg-neutral-900/80 transition-all">
                <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3">
                  <span>{post.date}</span>
                  <span>•</span>
                  <span>{post.readTime}</span>
                </div>
                
                <h2 className="text-xl md:text-2xl font-semibold text-white mb-3 group-hover:text-emerald-400 transition-colors">
                  {post.title}
                </h2>
                
                <p className="text-neutral-400 leading-relaxed mb-4">
                  {post.excerpt}
                </p>
                
                <span className="inline-flex items-center gap-2 text-sm text-emerald-500 font-medium">
                  Read on Substack
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </article>
            </a>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="text-center py-12 border-t border-neutral-800">
          <p className="text-neutral-500 mb-4">
            Want more? Subscribe to get every post.
          </p>
          <a
            href="https://pablof7z.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 border border-neutral-700 text-white rounded-lg hover:border-neutral-500 hover:bg-neutral-900 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
            </svg>
            Follow on Substack
          </a>
        </div>
      </section>
    </div>
  )
}
