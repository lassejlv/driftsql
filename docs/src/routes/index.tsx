import { createFileRoute, Link } from '@tanstack/react-router'
import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { baseOptions } from '@/lib/layout.shared'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <HomeLayout {...baseOptions()} className="min-h-screen">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="mb-8">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent">DriftSQL</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              A lightweight, type-safe SQL client for TypeScript with support for <span className="font-semibold text-blue-600">PostgreSQL</span>,{' '}
              <span className="font-semibold text-orange-600">MySQL</span>, <span className="font-semibold text-green-600">LibSQL/SQLite</span>, and{' '}
              <span className="font-semibold text-purple-600">Neon</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link
              to="/docs/$"
              params={{ _splat: '' }}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get Started
            </Link>
            <a
              href="https://github.com/lassejlv/driftsql"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl border-2 border-fd-border text-fd-foreground font-semibold text-lg hover:bg-fd-muted transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              View on GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/driftsql"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.669V8.667h8v5.331zM10.665 10H12v2.667h-1.335V10z" />
              </svg>
              npm
            </a>
          </div>

          {/* Code Preview */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-900 rounded-2xl p-6 text-left shadow-2xl border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-slate-400 text-sm">main.ts</span>
              </div>
              <pre className="text-sm overflow-x-auto">
                <code className="text-slate-300">
                  {`import { PostgresDriver, SQLClient } from 'driftsql'
import type { Database } from './db-types' // Generated types

const driver = new PostgresDriver({
  connectionString: 'postgresql://user:password@localhost:5432/mydb'
})

const client = new SQLClient<Database>({ driver })

// Type-safe queries with full IntelliSense
const user = await client.findFirst('users', { 
  email: 'john@example.com' 
}) // Returns Users | null

const posts = await client.findMany('posts', {
  where: { published: true },
  limit: 10
}) // Returns Posts[]`}
                </code>
              </pre>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          <div className="group p-8 rounded-2xl border border-fd-border hover:border-blue-300 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50/50 to-transparent">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-blue-900">🔐 Type Safe</h3>
            <p className="text-slate-600 leading-relaxed">Full TypeScript support with generated interfaces from your database schema. Catch errors at compile time, not runtime.</p>
          </div>

          <div className="group p-8 rounded-2xl border border-fd-border hover:border-purple-300 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-purple-50/50 to-transparent">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-purple-900">🔄 Unified API</h3>
            <p className="text-slate-600 leading-relaxed">Same interface across PostgreSQL, MySQL, LibSQL/SQLite, and Neon. Switch databases without changing your code.</p>
          </div>

          <div className="group p-8 rounded-2xl border border-fd-border hover:border-green-300 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50/50 to-transparent">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-green-900">🚀 Modular</h3>
            <p className="text-slate-600 leading-relaxed">Import only what you need with built-in SQL injection protection. Lightweight and tree-shakeable.</p>
          </div>

          <div className="group p-8 rounded-2xl border border-fd-border hover:border-orange-300 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-orange-50/50 to-transparent">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-orange-900">🛡️ Secure</h3>
            <p className="text-slate-600 leading-relaxed">Parameterized queries by default protect against SQL injection. Built with security best practices.</p>
          </div>

          <div className="group p-8 rounded-2xl border border-fd-border hover:border-teal-300 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-teal-50/50 to-transparent">
            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-teal-900">⚡ Transactions</h3>
            <p className="text-slate-600 leading-relaxed">Full transaction support with automatic rollback on errors. Ensure data consistency across operations.</p>
          </div>

          <div className="group p-8 rounded-2xl border border-fd-border hover:border-indigo-300 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-indigo-50/50 to-transparent">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-indigo-900">🔍 Schema Inspection</h3>
            <p className="text-slate-600 leading-relaxed">Automatically generate TypeScript interfaces from your database schema. Keep types in sync effortlessly.</p>
          </div>
        </div>

        {/* Database Support */}
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold mb-8 text-slate-800">Supports Your Favorite Databases</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center p-6 rounded-xl hover:bg-blue-50 transition-colors">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded text-white flex items-center justify-center font-bold">P</div>
              </div>
              <h3 className="font-semibold text-blue-900">PostgreSQL</h3>
              <p className="text-sm text-slate-600 mt-2">Full-featured with transactions</p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-xl hover:bg-orange-50 transition-colors">
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                <div className="w-8 h-8 bg-orange-600 rounded text-white flex items-center justify-center font-bold">M</div>
              </div>
              <h3 className="font-semibold text-orange-900">MySQL</h3>
              <p className="text-sm text-slate-600 mt-2">Reliable with connection pooling</p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-xl hover:bg-green-50 transition-colors">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <div className="w-8 h-8 bg-green-600 rounded text-white flex items-center justify-center font-bold">S</div>
              </div>
              <h3 className="font-semibold text-green-900">LibSQL/SQLite</h3>
              <p className="text-sm text-slate-600 mt-2">Local & remote with Turso</p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-xl hover:bg-purple-50 transition-colors">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <div className="w-8 h-8 bg-purple-600 rounded text-white flex items-center justify-center font-bold">N</div>
              </div>
              <h3 className="font-semibold text-purple-900">Neon</h3>
              <p className="text-sm text-slate-600 mt-2">Serverless PostgreSQL</p>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8 text-slate-800">Ready to Get Started?</h2>
          <div className="bg-slate-50 rounded-2xl p-8 max-w-2xl mx-auto border">
            <div className="text-left mb-6">
              <div className="bg-slate-900 rounded-lg p-4 text-slate-300 font-mono text-sm">
                <span className="text-green-400">$</span> bun add driftsql
              </div>
            </div>
            <p className="text-slate-600 mb-6">Install DriftSQL and start building type-safe database applications in minutes.</p>
            <Link
              to="/docs/$"
              params={{ _splat: '' }}
              className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Read the Documentation
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </HomeLayout>
  )
}
